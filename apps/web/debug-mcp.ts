import { TrueForge } from '@truefoundry/trueforge-sdk';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });
const client = new TrueForge({ baseUrl: process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790', token: process.env.TRUEFORGE_TOKEN });
try {
  const tools = await client.mcpServers.listTools('github');
  console.log('GitHub tools count:', (tools as any).data?.length ?? JSON.stringify(tools).slice(0, 800));
} catch(e:any) { console.log('listTools github failed:', e.message?.slice(0, 500)); }
try {
  const tools2 = await client.mcpServers.listTools('discord');
  console.log('Discord tools count:', (tools2 as any).data?.length ?? JSON.stringify(tools2).slice(0, 800));
} catch(e:any) { console.log('listTools discord failed:', e.message?.slice(0, 500)); }
