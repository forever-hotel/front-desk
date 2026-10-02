import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoomStatusBoardItem } from '../models/room-status-board-item';
import { RoomStatusTransitionPersistenceResult } from '../models/room-status-transition-persistence';
import { RoomStatus } from '../models/room-status';
import {
  RoomRepository,
  TransitionRoomStatusInput,
} from '../ports/room.repository';

interface RoomStatusBoardRow {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: RoomStatus;
  lastClearedAt: Date | string | null;
  updatedAt: Date | string;
}

interface LockedRoomRow {
  roomNumber: string;
  status: RoomStatus;
}

interface UpdatedRoomRow {
  roomNumber: string;
  status: RoomStatus;
  lastClearedAt: Date | string | null;
  updatedAt: Date | string;
}

@Injectable()
export class PostgresRoomRepository extends RoomRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findAllStatuses(): Promise<RoomStatusBoardItem[]> {
    const rows = (await this.dataSource.query(
      `
      SELECT
        r.room_number AS "roomNumber",
        r.room_type_id::text AS "roomTypeId",
        rt.type_name AS "roomTypeName",
        r.floor AS "floor",
        r.status::text AS "status",
        r.last_cleared_at AS "lastClearedAt",
        r.updated_at AS "updatedAt"
      FROM rooms r
      INNER JOIN room_types rt
        ON rt.room_type_id = r.room_type_id
      ORDER BY
        r.floor ASC,
        r.room_number ASC
      `,
    )) as RoomStatusBoardRow[];

    return rows.map((row) => ({
      roomNumber: row.roomNumber,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomTypeName,
      floor: row.floor,
      status: row.status,
      lastClearedAt: this.toIsoOrNull(row.lastClearedAt),
      updatedAt: this.toIso(row.updatedAt),
    }));
  }

  async transitionStatus(
    input: TransitionRoomStatusInput,
  ): Promise<RoomStatusTransitionPersistenceResult> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const roomRows = (await queryRunner.query(
        `
        SELECT
          room_number AS "roomNumber",
          status::text AS "status"
        FROM rooms
        WHERE room_number = $1
        FOR UPDATE
        `,
        [input.roomNumber],
      )) as LockedRoomRow[];

      if (roomRows.length === 0) {
        await queryRunner.rollbackTransaction();

        return {
          kind: 'not_found',
        };
      }

      const currentRoom = roomRows[0];

      if (currentRoom.status === input.targetStatus) {
        await queryRunner.rollbackTransaction();

        return {
          kind: 'same_state',
          currentStatus: currentRoom.status,
        };
      }

      if (!input.allowedCurrentStatuses.includes(currentRoom.status)) {
        await queryRunner.rollbackTransaction();

        return {
          kind: 'blocked',
          currentStatus: currentRoom.status,
        };
      }

      const rawUpdateResult = (await queryRunner.query(
        `
          UPDATE rooms
          SET
            status = $1::room_status,
            last_cleared_at =
              CASE
                WHEN $1::room_status = 'VACANT'::room_status
                  THEN NOW()
                ELSE last_cleared_at
              END,
            updated_at = NOW()
          WHERE room_number = $2
          RETURNING
            room_number AS "roomNumber",
            status::text AS "status",
            last_cleared_at AS "lastClearedAt",
            updated_at AS "updatedAt"
          `,
        [input.targetStatus, input.roomNumber],
      )) as unknown[];

      /*
       * TypeORM's PostgreSQL QueryRunner may return
       * UPDATE results as:
       *
       *   [rows, affectedRowCount]
       *
       * while unit-test mocks may return:
       *
       *   rows
       *
       * Normalize both shapes before reading the
       * returned room.
       */
      const updatedRows = Array.isArray(rawUpdateResult[0])
        ? (rawUpdateResult[0] as UpdatedRoomRow[])
        : (rawUpdateResult as UpdatedRoomRow[]);

      const updatedRoom = updatedRows[0];

      if (!updatedRoom) {
        throw new Error(
          `Room ${input.roomNumber} was not returned after status update`,
        );
      }

      /*
       * Build the result before COMMIT.
       *
       * If timestamp conversion or result mapping
       * unexpectedly fails, the transaction is still
       * active and can safely be rolled back.
       */
      const result: RoomStatusTransitionPersistenceResult = {
        kind: 'updated',
        value: {
          roomNumber: updatedRoom.roomNumber,
          previousStatus: currentRoom.status,
          status: updatedRoom.status,
          lastClearedAt: this.toIsoOrNull(updatedRoom.lastClearedAt),
          updatedAt: this.toIso(updatedRoom.updatedAt),
        },
      };

      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private toIso(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }

  private toIsoOrNull(value: Date | string | null): string | null {
    if (value === null) {
      return null;
    }

    return this.toIso(value);
  }
}
