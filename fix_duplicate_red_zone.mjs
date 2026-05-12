import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

const regex = /\{isAdmin && \(\n                        <article className="fc-card rounded-2xl p-6 border border-red-500\/25 bg-gradient-to-br from-red-500\/14 via-white dark:via-\[#161d24\] to-white dark:to-\[#161d24\] flex flex-col justify-between">\n                            <div>\n                                <div className="flex items-center justify-between mb-4">\n                                    <p className="text-\[10px\] font-black uppercase tracking-widest text-red-400">Red Zone Members<\/p>\n                                    <ShieldAlert className="w-4 h-4 text-red-400" \/>\n                                <\/div>\n                                <p className="text-2xl font-black tabular-nums text-white">\{redZoneCount\}<\/p>\n                                <p className="text-\[11px\] text-gray-600 dark:text-gray-400 mt-2">Members with pending deposits<\/p>\n                            <\/div>\n                            <button onClick=\{shareRedZone\} className="mt-4 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-500\/10 hover:bg-red-500\/20 text-red-400 rounded-lg text-\[10px\] font-black uppercase tracking-widest transition-colors w-full border border-red-500\/20">\n                                Notify Group <Share2 className="w-3 h-3" \/>\n                            <\/button>\n                        <\/article>\n                    \)\}\n\n/g;

// Replace two occurrences with one. Or just manually replace the first occurrence found since there are 2.
let matchCount = (finContent.match(regex) || []).length;
if(matchCount === 2) {
    finContent = finContent.replace(regex, ""); // Replaces all, we need to add back one. Or we can replace once. Wait, JavaScript .replace with regex missing 'g' acts only on the first match! But I added 'g'. Let's remove 'g'.
}

