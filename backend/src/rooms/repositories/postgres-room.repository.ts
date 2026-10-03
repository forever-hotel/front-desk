import { BadRequestException, Injectable } from '@nestjs/common';
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

type MaintenanceAuditAction =
  'ROOM_MAINTENANCE_BLOCKED' | 'ROOM_MAINTENANCE_CLEARED';

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

      const maintenanceAuditAction = this.getMaintenanceAuditAction(
        currentRoom.status,
        input.targetStatus,
      );

      if (maintenanceAuditAction) {
        if (!input.performedBy) {
          throw new BadRequestException(
            'performedBy is required for maintenance transitions',
          );
        }

        const staffRows = await queryRunner.query(
          `
            SELECT
              worker_id::text AS "workerId",
              role::text AS "role",
              is_active AS "isActive"
            FROM staff_users
            WHERE worker_id = $1
            LIMIT 1
            FOR SHARE
            `,
          [input.performedBy],
        );

        if (
          staffRows.length === 0 ||
          staffRows[0].role !== 'RECEPTIONIST' ||
          staffRows[0].isActive !== true
        ) {
          throw new BadRequestException(
            'Maintenance change must be performed by an active receptionist',
          );
        }
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

      const updatedRows =
        this.normalizeMutationRows<UpdatedRoomRow>(rawUpdateResult);

      const updatedRoom = updatedRows[0];

      if (!updatedRoom) {
        throw new Error(
          `Room ${input.roomNumber} was not returned after status update`,
        );
      }

      /*
       * Maintenance blocking/clearing is
       * audited in the SAME transaction as
       * the room-state change.
       */
      if (maintenanceAuditAction && input.performedBy) {
        const auditDetails = {
          previousStatus: currentRoom.status,
          targetStatus: input.targetStatus,
          notes: input.notes ?? null,
        };

        await queryRunner.query(
          `
          INSERT INTO audit_logs (
            event_category,
            actor_type,
            staff_user_id,
            action,
            entity_type,
            entity_id,
            details
          )
          VALUES (
            'FRONT_DESK_OPERATION',
            'STAFF',
            $1,
            $2,
            'ROOM',
            $3,
            $4::jsonb
          )
          `,
          [
            input.performedBy,
            maintenanceAuditAction,
            input.roomNumber,
            JSON.stringify(auditDetails),
          ],
        );
      }

      /*
       * Build the response before COMMIT so
       * any mapping/conversion failure occurs
       * while rollback is still possible.
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

  private getMaintenanceAuditAction(
    currentStatus: RoomStatus,
    targetStatus: RoomStatus,
  ): MaintenanceAuditAction | null {
    if (
      currentStatus === RoomStatus.VACANT &&
      targetStatus === RoomStatus.UNDER_MAINTENANCE
    ) {
      return 'ROOM_MAINTENANCE_BLOCKED';
    }

    if (
      currentStatus === RoomStatus.UNDER_MAINTENANCE &&
      targetStatus === RoomStatus.VACANT
    ) {
      return 'ROOM_MAINTENANCE_CLEARED';
    }

    return null;
  }

  private normalizeMutationRows<T>(rawResult: unknown[]): T[] {
    if (Array.isArray(rawResult[0])) {
      return rawResult[0] as T[];
    }

    return rawResult as T[];
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
