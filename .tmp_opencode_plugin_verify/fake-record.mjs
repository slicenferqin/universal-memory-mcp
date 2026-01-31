import fs from 'node:fs';
const input = fs.readFileSync(0, 'utf8');
fs.writeFileSync(process.env.UM_OUTFILE, input);
process.stdout.write('ok\n');
