import fs from 'fs';
let content = fs.readFileSync('src/pages/AdminCommandCenter.tsx', 'utf8');

// 1. Replace the inner loop finding the winner
const matchLoop = `let winner: any = null;
      let winningPoints = 0;

      for (const fplManager of sortedStandings) {
        // Match via team IDs, displayName, or fplTeamName
        const dbMember = members.find(
          (m) =>
            (m.fplTeamId && Number(m.fplTeamId) === Number(fplManager.entry)) ||
            (m.secondFplTeamId &&
              Number(m.secondFplTeamId) === Number(fplManager.entry)) ||
            m.displayName === fplManager.player_name ||
            (m as any).fplTeamName === fplManager.entry_name,
        );

        if (dbMember) {
          if (
            memberHasFunding(dbMember) &&
            Number(fplManager.event_total || 0) > 0
          ) {
            winner = dbMember;
            winningPoints = Number(fplManager.event_total || 0);
            break;
          }
        }
      }

      if (!winner) {`;

const newLoop = `let winners: any[] = [];
      let winningPoints = 0;

      for (const fplManager of sortedStandings) {
        const dbMember = members.find(
          (m) =>
            (m.fplTeamId && Number(m.fplTeamId) === Number(fplManager.entry)) ||
            (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(fplManager.entry)) ||
            m.displayName === fplManager.player_name ||
            (m as any).fplTeamName === fplManager.entry_name,
        );

        if (dbMember && memberHasFunding(dbMember) && Number(fplManager.event_total || 0) > 0) {
            const pts = Number(fplManager.event_total || 0);
            if (winners.length === 0) {
                winners.push(dbMember);
                winningPoints = pts;
            } else if (pts === winningPoints) {
                winners.push(dbMember); // Tied!
            } else {
                break; // Because it's sorted, remaining scores are lower
            }
        }
      }
      
      // Map for template logic compatibility below
      const winner = winners[0];

      if (winners.length === 0) {`;

content = content.replace(matchLoop, newLoop);

const matchAddDocBlock = `// Feature: Maker / Checker (Requires Approval)
        const pendingPayoutsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "pending_payouts",
        );
        await addDoc(pendingPayoutsRef, {
          winnerId: winner.id,
          winnerName: winner.displayName,
          winnerPhone: winner.phone,
          amount: weeklyPot,
          points: winningPoints,
          gw: gwNumber,
          status: "awaiting_approval",
          method: payoutMethod,
          requestedBy,
          approvalTarget: "co-chair",
          timestamp: serverTimestamp(),
        });`;

const newAddDocBlock = `// Feature: Maker / Checker (Requires Approval)
        const pendingPayoutsRef = collection(db, "leagues", activeLeagueId, "pending_payouts");
        const splitAmount = winners.length > 0 ? Number((weeklyPot / winners.length).toFixed(0)) : 0;
        
        for (const w of winners) {
          await addDoc(pendingPayoutsRef, {
            winnerId: w.id,
            winnerName: w.displayName + (winners.length > 1 ? " (Tie)" : ""),
            winnerPhone: w.phone,
            amount: splitAmount,
            points: winningPoints,
            gw: gwNumber,
            status: "awaiting_approval",
            method: payoutMethod,
            requestedBy,
            approvalTarget: "co-chair",
            timestamp: serverTimestamp(),
          });
        }`;

content = content.replace(matchAddDocBlock, newAddDocBlock);

const matchNoCoChair = `const pendingPayoutsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "pending_payouts",
        );
        await addDoc(pendingPayoutsRef, {
          winnerId: winner.id,
          winnerName: winner.displayName,
          winnerPhone: winner.phone,
          amount: weeklyPot,
          points: winningPoints,
          gw: gwNumber,
          status: "awaiting_approval",
          method: payoutMethod,
          requestedBy,
          approvalTarget: "chairman",
          timestamp: serverTimestamp(),
        });`;

const newNoCoChair = `const pendingPayoutsRef = collection(db, "leagues", activeLeagueId, "pending_payouts");
        const splitAmount = winners.length > 0 ? Number((weeklyPot / winners.length).toFixed(0)) : 0;
        for (const w of winners) {
          await addDoc(pendingPayoutsRef, {
            winnerId: w.id,
            winnerName: w.displayName + (winners.length > 1 ? " (Tie)" : ""),
            winnerPhone: w.phone,
            amount: splitAmount,
            points: winningPoints,
            gw: gwNumber,
            status: "awaiting_approval",
            method: payoutMethod,
            requestedBy,
            approvalTarget: "chairman",
            timestamp: serverTimestamp(),
          });
        }`;

content = content.replace(matchNoCoChair, newNoCoChair);

fs.writeFileSync('src/pages/AdminCommandCenter.tsx', content);
console.log("Patched ties logic ok!");
