import { IsUUID } from 'class-validator';

export class AssignServiceTaskDto {
  @IsUUID('4')
  workerId!: string;
}
