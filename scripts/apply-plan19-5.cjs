/**
 * Plan 19.5: conservative, idempotent source integration.
 * Only touches the two established screens; checks all anchors first.
 * Run from the front-desk repository root after extracting the ZIP.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const checkInPath = path.join(root, "frontend/src/features/check-ins/components/check-in-screen.tsx");
const folioPath = path.join(root, "frontend/src/features/folios/components/guest-folio-screen.tsx");

function requireFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Expected file missing: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}
function replaceExactlyOnce(source, target, replacement, label) {
  if (!source.includes(target)) {
    throw new Error(`Source has changed: could not find ${label}; no files were modified.`);
  }
  if (source.indexOf(target) !== source.lastIndexOf(target)) {
    throw new Error(`Ambiguous source: multiple ${label} anchors; no files were modified.`);
  }
  return source.replace(target, replacement);
}
function removeBlock(source, from, until, label) {
  const start = source.indexOf(from);
  const end = source.indexOf(until, start + from.length);
  if (start < 0 || end < 0) {
    throw new Error(`Source has changed: could not locate ${label}; no files were modified.`);
  }
  return source.slice(0, start) + source.slice(end);
}
function integrateCheckIn(source) {
  if (source.includes('import { CheckInDocumentPrintActions } from "./check-in-document-print-actions";')) {
    return source;
  }
  source = replaceExactlyOnce(
    source,
    'import { useCheckInPrint } from "../hooks/use-check-in-print";',
    'import { CheckInDocumentPrintActions } from "./check-in-document-print-actions";',
    'print hook import',
  );
  source = replaceExactlyOnce(
    source,
    '  const printMutation = useCheckInPrint();\n\n',
    '',
    'print mutation declaration',
  );
  // Both reset calls belong to the removed mutation in search/select handlers.
  source = source.replaceAll('    printMutation.reset();\n', '');
  source = removeBlock(
    source,
    '  const handlePrintRegistrationCard = async () => {',
    '  return (\n    <section',
    'original print handler',
  );
  source = removeBlock(
    source,
    '            {printMutation.isError && (',
    '            <div className={styles.confirmActions}>',
    'original print feedback',
  );
  const oldButton = `              <Button
                disabled={!checkInResult}
                loading={printMutation.isPending}
                onClick={() => void handlePrintRegistrationCard()}
              >
                Print Registration Card
              </Button>`;
  const newActions = `              <CheckInDocumentPrintActions
                bookingReference={checkInResult?.bookingReference}
              />`;
  source = replaceExactlyOnce(source, oldButton, newActions, 'check-in print button');
  if (source.includes('printMutation') || source.includes('handlePrintRegistrationCard')) {
    throw new Error('Unexpected original print code remains in check-in screen; no files were modified.');
  }
  return source;
}
function integrateFolio(source) {
  if (source.includes('import { CheckInDocumentPrintActions } from "@/features/check-ins/components/check-in-document-print-actions";')) {
    return source;
  }
  source = replaceExactlyOnce(
    source,
    'import { List } from "lucide-react";\n',
    'import { List } from "lucide-react";\n\nimport { CheckInDocumentPrintActions } from "@/features/check-ins/components/check-in-document-print-actions";\n',
    'guest folio import anchor',
  );
  const anchor = `      {selectedBooking && folio && (
        <div className={styles.folioGrid}>`;
  const section = `      {selectedBooking && folio && (
        <section className={styles.card} aria-label="Check-in document requests">
          <div className={styles.cardHeader}>CHECK-IN DOCUMENT REQUESTS</div>
          <div className={styles.searchBody}>
            <p>
              Registration card and payment-receipt requests are available for
              this checked-in booking. An accepted print job does not confirm
              that a physical printer has completed the document.
            </p>
            <CheckInDocumentPrintActions
              key={folio.bookingReference}
              bookingReference={folio.bookingReference}
            />
          </div>
        </section>
      )}

`;
  source = replaceExactlyOnce(source, anchor, section + anchor, 'guest folio print section');
  return source;
}

try {
  const originalCheckIn = requireFile(checkInPath);
  const originalFolio = requireFile(folioPath);
  const nextCheckIn = integrateCheckIn(originalCheckIn);
  const nextFolio = integrateFolio(originalFolio);
  // All transforms succeeded before any write.
  if (nextCheckIn !== originalCheckIn) {
    fs.writeFileSync(checkInPath, nextCheckIn);
    console.log('Updated: frontend/src/features/check-ins/components/check-in-screen.tsx');
  }
  if (nextFolio !== originalFolio) {
    fs.writeFileSync(folioPath, nextFolio);
    console.log('Updated: frontend/src/features/folios/components/guest-folio-screen.tsx');
  }
  console.log('Plan 19.5 source integration complete. Run Prettier, TypeScript, tests, lint, build.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
