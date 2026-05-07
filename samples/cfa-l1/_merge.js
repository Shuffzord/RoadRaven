const fs = require('fs');
const path = process.argv[2];
const lmFile = process.argv[3];
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const lm = JSON.parse(fs.readFileSync(lmFile, 'utf8'));
d.children.push(lm);
fs.writeFileSync(path, JSON.stringify(d, null, 2));
let leafCount = 0, leafHours = 0;
function walk(n) {
  if (n.type === 'task') { leafCount++; leafHours += (n.metadata?.estimated_hours || 0); }
  (n.children || []).forEach(walk);
}
walk(d);
console.log('children=' + d.children.length + ' leaves=' + leafCount + ' hours=' + leafHours.toFixed(2));
