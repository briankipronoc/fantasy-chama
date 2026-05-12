import fs from 'fs';
let sPath = 'src/pages/Standings.tsx';
let sContent = fs.readFileSync(sPath, 'utf8');

const oldFetch = `const fetchFplStandings = async (leagueId: number) => {`;
const newFetch = `const fetchFplStandings = async (leagueId: number) => {
    // Check cache
    const cacheKey = \`fpl_standings_\${leagueId}\`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        // 5-minute TTL caching to prevent Firebase/FPL quota limits during mass refreshes
        if (Date.now() - timestamp < 300000) {
            return data;
        }
    }`;

sContent = sContent.replace(oldFetch, newFetch);

// Let's also patch where the data is returned to update the cache
const oldReturn = `return data.standings.results;`;
const newReturn = `
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data.standings.results }));
                return data.standings.results;`;

sContent = sContent.replace(oldReturn, newReturn);

fs.writeFileSync(sPath, sContent);
console.log("Standings cache updated!");
