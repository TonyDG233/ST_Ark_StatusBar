import { z } from 'zod';
import { CharacterSchema } from './schemas/character';
import { ChronicleSchema } from './schemas/chronicle';
import { GlobalStateSchema, TaskQueueSchema } from './schemas/global';
import { PlayerSchema } from './schemas/player';

export const Schema = z.object({
  global: GlobalStateSchema,
  characters: z.record(z.string(), CharacterSchema),
  player: PlayerSchema,
  chronicle: ChronicleSchema,
  task_queue: TaskQueueSchema,
});
