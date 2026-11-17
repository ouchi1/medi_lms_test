import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

// វាលោតទាញយក DATABASE_URL ពីឯកសារ .env ដោយស្វ័យប្រវត្តិ
const sql = neon(process.env.DATABASE_URL);

export default sql;