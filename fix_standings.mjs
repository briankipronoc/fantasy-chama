import fs from 'fs';
let standPath = 'src/pages/Standings.tsx';
let standContent = fs.readFileSync(standPath, 'utf8');

const t = `{/* Live Gameweek Winner Gold UI */}`;
const idx = standContent.indexOf(t);

if (idx !== -1) {
    const endT = `</div>
                        )}
                    </div>`;
    const endIdx = standContent.indexOf(endT, idx);
    
    if (endIdx !== -1) {
        // remove the upper div too
        const parentStart = `{/* GW Winner */}
                {!error && standingsData.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 mt-6">`;
        
        let newContent = standContent.substring(0, standContent.indexOf(parentStart));
        let afterIdx = endIdx + endT.length;
        // Wait, the parent `)}` is right after.
        const parentEnd = `)}

                {/* Table */}`;
        const afterParentIdx = standContent.indexOf(parentEnd, afterIdx) + parentEnd.length;
        
        newContent += `\n                {/* Table */}` + standContent.substring(afterParentIdx);
        fs.writeFileSync(standPath, newContent);
        console.log("Removed GW Winner card");
    }
}
