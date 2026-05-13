import fs from 'fs';
let profPath = 'src/pages/Profile.tsx';
let profContent = fs.readFileSync(profPath, 'utf8');

const t = `                        </div>
                    )}
                    {isAdminView && renderActiveMembersStrip('order-3 xl:hidden')}

                </div>
            </div>`;

const diagnosticsBlock = `
                        </div>
                    )}
                    
                    {isAdminView && (
                        <div className="fc-card xl:col-span-12 bg-[#161d24] border border-[#22c55e]/20 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col mt-4">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e] blur-[100px] opacity-5 transform translate-x-10 -translate-y-10"></div>
                            
                            <h2 className="text-sm font-black flex items-center gap-2 mb-6 uppercase tracking-widest text-[#22c55e]">
                                <Activity className="w-5 h-5" /> System Diagnostics
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Auth Node</p>
                                    <p className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1.5 rounded-lg border border-white/5 w-fit">{auth.currentUser?.uid ? \`•••\${auth.currentUser.uid.slice(-6)}\` : "None"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Chairman Key</p>
                                    <p className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1.5 rounded-lg border border-white/5 w-fit">{chairmanId ? \`•••\${chairmanId.slice(-6)}\` : "None"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Co-Admin Key</p>
                                    <p className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1.5 rounded-lg border border-white/5 w-fit">{coAdminId ? \`•••\${coAdminId.slice(-6)}\` : "None"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Perms Flag</p>
                                    <div className="flex gap-2 text-[10px] items-center h-full">
                                        <span className={chairmanId && auth.currentUser?.uid === chairmanId ? "text-[#22c55e] font-bold" : "text-gray-600"}>Chair</span>
                                        <span className="text-gray-700">•</span>
                                        <span className={coAdminId && auth.currentUser?.uid === coAdminId ? "text-[#22c55e] font-bold" : "text-gray-600"}>Co-Admin</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {isAdminView && renderActiveMembersStrip('order-3 xl:hidden')}

                </div>
            </div>`;

profContent = profContent.replace(t, diagnosticsBlock);

// ensure Activity from lucide-react is imported
if (!profContent.includes('Activity,')) {
    profContent = profContent.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { Activity, $1 } from 'lucide-react';");
}

fs.writeFileSync(profPath, profContent);
console.log("diagnostics block added");
