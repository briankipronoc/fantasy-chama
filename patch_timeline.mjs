import fs from 'fs';
const path = 'src/pages/AdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the pendingPayouts.length useEffect with a complete timeline sync

const targetEffect = `  useEffect(() => {
    if (pendingPayouts.length > 0) {
      setActionTimeline((prev) => ({
        ...prev,
        approvalPending: true,
        resolved: true,
      }));
      return;
    }
    setActionTimeline((prev) => ({ ...prev, approvalPending: false }));
  }, [pendingPayouts.length]);`;

const newEffect = `  useEffect(() => {
    // If FPL moved on to a new active gameweek and no pending payouts remain, reset the timeline for the new week.
    if (!hasFinalGwChampion && pendingPayouts.length === 0) {
      setActionTimeline({
        resolved: false,
        approvalPending: false,
        payoutSent: false,
        confirmed: false,
      });
      return;
    }

    if (pendingPayouts.length > 0) {
      setActionTimeline((prev) => ({
        ...prev,
        approvalPending: true,
        resolved: true,
      }));
      return;
    }
    setActionTimeline((prev) => ({ ...prev, approvalPending: false }));
  }, [pendingPayouts.length, hasFinalGwChampion]);`;

if (content.includes(targetEffect)) {
    content = content.replace(targetEffect, newEffect);
    fs.writeFileSync(path, content);
    console.log("Timeline patched via regex.");
} else {
    console.log("Could not find timeline useEffect block to patch.");
}
