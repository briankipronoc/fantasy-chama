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
        console.log("Removed system diagnostics card HTML again");
    }
}
adminContent = adminContent.replace(/const diagnosticsStatusLabel[\s\S]*?;/g, "");
adminContent = adminContent.replace(/const diagnosticsIsChairman[\s\S]*?;/g, "");
adminContent = adminContent.replace(/const diagnosticsIsCoAdmin[\s\S]*?;/g, "");
adminContent = adminContent.replace(/const authUid[\s\S]*?;/g, "");
adminContent = adminContent.replace(/const coAdminResolvedUid[\s\S]*?;/g, "");
adminContent = adminContent.replace(/const coAdminMemberAuthUid[\s\S]*?;/g, "");

// Prefix chairmanId with // @ts-ignore on line 69 just for safety if unused, actually I will just add // @ts-ignore
adminContent = adminContent.replace(/const \[chairmanId, setChairmanId\] = useState<string \| null>\(null\);/g, "// @ts-ignore\n    const [chairmanId, setChairmanId] = useState<string | null>(null);");

fs.writeFileSync(adminPath, adminContent);
