import fs from 'fs';
let adminPath = 'src/pages/AdminCommandCenter.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

const t = `{activeTab === "dashboard" && diagnosticsIsAdmin && (
            <section className="mt-8 pt-6 border-t border-white/5">`;
const idx = adminContent.indexOf(t);

if (idx !== -1) {
    const endT = `            </section>
          )}`;
    const endIdx = adminContent.indexOf(endT, idx);
    if (endIdx !== -1) {
        adminContent = adminContent.substring(0, idx) + adminContent.substring(endIdx + endT.length);
        fs.writeFileSync(adminPath, adminContent);
        console.log("Removed system diagnostics card");
    }
}
