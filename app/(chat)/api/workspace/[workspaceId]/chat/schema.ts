import { z } from 'zod';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum([
    'image/jpeg',
    'image/png',
    'text/plain',
    'text/vtt',
    'application/pdf',
  ]),
  name: z.string().min(1).max(256), // Increased limit for longer filenames
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(partSchema),
  }),
  selectedVisibilityType: z.enum(['public', 'private']),
  objectiveId: z.string().uuid().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
