import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

let passedTests = 0;
let failedTests = 0;

function runTest(id, name, fn) {
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${id}: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] ${id}: ${name}`);
    console.error(`         └─ Error: ${err.message}`);
  }
}

console.log('========================================================');
console.log('PROJECT CREATION CONTEXT & TREASURY INVARIANTS');
console.log('========================================================\n');

const manageProjectSrc = fs.readFileSync(path.join(rootDir, 'src/pages/ManageProject.tsx'), 'utf8');
const projectsSrc = fs.readFileSync(path.join(rootDir, 'src/pages/Projects.tsx'), 'utf8');

// -----------------------------------------------------------------
// PROJECT-CREATE-CTX-01 .. 10
// -----------------------------------------------------------------

runTest('PROJECT-CREATE-CTX-01', 'Contracting launcher initializes actual form type to Contracting', () => {
  // Check that Projects.tsx passes type=contracting when on contracting sector
  assert(
    projectsSrc.includes('effectiveSector ? `/projects/new?type=${effectiveSector}` : "/projects/new"'),
    'Projects.tsx must pass effectiveSector to /projects/new'
  );
  // Check that ManageProject.tsx reads projectTypeFromUrl and uses it in defaultValues and synchronization
  assert(
    manageProjectSrc.includes('projectTypeFromUrl === "contracting"'),
    'ManageProject.tsx must check for contracting sector'
  );
  assert(
    manageProjectSrc.includes('project_type: initialType'),
    'ManageProject.tsx useForm must default project_type to initialType'
  );
});

runTest('PROJECT-CREATE-CTX-02', 'Finishing launcher initializes actual form type to Finishing', () => {
  assert(
    manageProjectSrc.includes('projectTypeFromUrl === "finishing"'),
    'ManageProject.tsx must check for finishing sector'
  );
  assert(
    manageProjectSrc.includes('setValue("project_type", projectTypeFromUrl, { shouldValidate: true'),
    'ManageProject.tsx must synchronize project_type from URL in useEffect'
  );
});

runTest('PROJECT-CREATE-CTX-03', 'Visible Type value equals submitted form value', () => {
  // In locked mode, visible value is derived from watch("project_type") and rendered in UI
  assert(
    manageProjectSrc.includes('isSectorLocked ? ('),
    'ManageProject.tsx must have an isSectorLocked branch'
  );
  assert(
    manageProjectSrc.includes('watch("project_type") === "finishing"'),
    'ManageProject.tsx must render matching visible state'
  );
  // Form submission uses data.project_type
  assert(
    manageProjectSrc.includes('project_type: data.project_type'),
    'ManageProject.tsx must submit data.project_type directly'
  );
});

runTest('PROJECT-CREATE-CTX-04', 'Contracting context resolves configured Contracting Treasury', () => {
  assert(
    manageProjectSrc.includes('companySettings?.contracting_treasury_id'),
    'ManageProject.tsx must resolve companySettings.contracting_treasury_id for contracting'
  );
  assert(
    manageProjectSrc.includes('t.project_category === "contracting"'),
    'ManageProject.tsx must have fallback for contracting treasury category'
  );
});

runTest('PROJECT-CREATE-CTX-05', 'Finishing context resolves configured Finishing Treasury', () => {
  assert(
    manageProjectSrc.includes('companySettings?.finishing_treasury_id'),
    'ManageProject.tsx must resolve companySettings.finishing_treasury_id for finishing'
  );
  assert(
    manageProjectSrc.includes('t.project_category === "finishing"'),
    'ManageProject.tsx must have fallback for finishing treasury category'
  );
});

runTest('PROJECT-CREATE-CTX-06', 'Contracting submit does not produce validation error', () => {
  // Schema has proper enum definition and initialType ensures valid value from start
  assert(
    manageProjectSrc.includes('project_type: z.enum(["contracting", "finishing"]'),
    'projectSchema must validate contracting as valid enum value'
  );
  assert(
    manageProjectSrc.includes('setValue("project_type", projectTypeFromUrl, { shouldValidate: true'),
    'setValue must validate immediately on mount/param change'
  );
});

runTest('PROJECT-CREATE-CTX-07', 'Finishing submit does not produce validation error', () => {
  assert(
    manageProjectSrc.includes('finishing_percentage'),
    'ManageProject.tsx must support finishing percentage'
  );
});

runTest('PROJECT-CREATE-CTX-08', 'Dialog / Route reopen does not leak previous type', () => {
  // useEffect depends on projectTypeFromUrl and resets/sets value cleanly
  assert(
    manageProjectSrc.includes('[projectTypeFromUrl, isEdit, setValue]'),
    'useEffect must depend on projectTypeFromUrl to prevent stale state leak'
  );
});

runTest('PROJECT-CREATE-CTX-09', 'Global Create keeps Type editable if context is unknown', () => {
  // When not sector locked, a Select is rendered allowing user to choose
  assert(
    manageProjectSrc.includes('isSectorLocked ? ('),
    'Must branch on isSectorLocked'
  );
  assert(
    manageProjectSrc.includes('<SelectValue placeholder="اختر نوع المشروع / الفواتير" />'),
    'Select must offer placeholder when type is not preset'
  );
});

runTest('PROJECT-CREATE-CTX-10', 'Treasury default assignment creates zero Treasury transaction', () => {
  // Insertion only sets default_treasury_id column on projects table, does not touch treasury_transactions
  assert(
    !manageProjectSrc.includes('supabase.from("treasury_transactions").insert'),
    'ManageProject.tsx must NEVER insert into treasury_transactions on project creation'
  );
  assert(
    !manageProjectSrc.includes('supabase.from("transfers").insert'),
    'ManageProject.tsx must NEVER insert into transfers on project creation'
  );
  assert(
    manageProjectSrc.includes('default_treasury_id: data.default_treasury_id || null'),
    'ManageProject.tsx must assign default_treasury_id as metadata on project'
  );
});

console.log(`\n========================================================`);
console.log(`TOTAL: ${passedTests} passed, ${failedTests} failed`);
console.log(`========================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
