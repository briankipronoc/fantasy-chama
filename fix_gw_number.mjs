import fs from 'fs';
let path = 'src/pages/AdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace setCurrentGwNumber(Number(current?.id || 0) || null);
// Let's first search for how we get 'current' from bootstrap data.
