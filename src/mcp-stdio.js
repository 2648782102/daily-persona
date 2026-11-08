import readline from 'node:readline';
import { PROTOCOL_VERSION, handleMcpRequest } from './mcp.js';

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

for await (const line of input) {
  if (line.trim().length === 0) {
    continue;
  }

  let request;
  try {
    request = JSON.parse(line);
  } catch {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: undefined,
      error: { code: -32700, message: 'Parse error' },
    })}\n`);
    continue;
  }

  if (request.id === undefined) {
    continue;
  }

  if (request.method === 'server/discover' && !request.params?._meta?.['io.modelcontextprotocol/protocolVersion']) {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32022,
        message: 'Unsupported protocol version',
        data: { supported: [PROTOCOL_VERSION] },
      },
    })}\n`);
    continue;
  }

  const response = await handleMcpRequest(request);
  process.stdout.write(`${JSON.stringify(response)}\n`);
}
