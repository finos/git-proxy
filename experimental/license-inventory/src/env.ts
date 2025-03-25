import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    MONGO_URI: z.string(),
  })
  .required();

const { error, data: env } = envSchema.safeParse(process.env);
if (error) {
  console.error(error);
  throw new Error('failed to validate');
}

export default env as z.infer<typeof envSchema>;
