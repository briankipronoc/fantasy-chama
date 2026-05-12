import fs from 'fs';
import path from 'path';

const pages = [
  'src/pages/Finances.tsx',
  'src/pages/Profile.tsx',
  'src/pages/Standings.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/MemberDashboard.tsx',
  'src/pages/AdminCommandCenter.tsx'
];

pages.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Fix via-[#161d24] to-[#161d24]
    content = content.replace(/via-\[\#161d24\]/g, 'via-white dark:via-[#161d24]');
    content = content.replace(/to-\[\#161d24\]/g, 'to-white dark:to-[#161d24]');
    
    // Fix text-white in headers
    content = content.replace(/text-2xl md:text-3xl font-black text-white/g, 'text-2xl md:text-3xl font-black text-gray-900 dark:text-white');
    content = content.replace(/text-xl md:text-2xl font-black text-white/g, 'text-xl md:text-2xl font-black text-gray-900 dark:text-white');

    // Fix text-gray-300
    content = content.replace(/text-gray-300/g, 'text-gray-600 dark:text-gray-300');

    fs.writeFileSync(file, content);
  }
});
