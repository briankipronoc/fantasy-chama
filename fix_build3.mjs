import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

finContent = finContent.replace(
    `const redZoneCount = members.filter((m) => m.role !== 'admin' && m.isActive !== false && !m.hasPaid).length;\n    const findMemberLine((member) => member.isActive !== false).length;`,
    `const redZoneCount = members.filter((m) => m.role !== 'admin' && m.isActive !== false && !m.hasPaid).length;\n    const activeMembersCount = members.filter((member) => member.isActive !== false).length;`
);

fs.writeFileSync(finPath, finContent);
