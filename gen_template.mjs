import { generateGridTemplate } from './server/gridTemplate.ts';
import fs from 'fs';

const buf = await generateGridTemplate({ rows: 3, cols: 3, totalPanels: 6 });
fs.writeFileSync('/home/ubuntu/grid_prompt_export/ref4_grid_template.png', buf);
console.log('Grid template saved:', buf.length, 'bytes');
