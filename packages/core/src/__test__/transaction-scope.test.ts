import { expect } from "expect";
import { RollbackError, TransactionScope } from "../TransactionScope.ts";

Deno.test("TransactionScope: complete calls commit", async () => {
  let commitCalled = false;
  let rollbackCalled = false;

  try {
    await using scope = new TransactionScope({
      commit: () => { commitCalled = true; },
      rollback: () => { rollbackCalled = true; },
    });
  
    // Mark the transaction as complete.
    scope.complete();
  } catch {}

  expect(commitCalled).toBe(true);
  expect(rollbackCalled).toBe(false);
});

Deno.test("TransactionScope: not complete calls rollback and throws RollbackError", async () => {
  let commitCalled = false;
  let rollbackCalled = false;
  let thrownError = null;

 try {
  await using scope = new TransactionScope({
    commit: () => { commitCalled = true; },
    rollback: () => { rollbackCalled = true; },
  });
 } catch (e) {
  thrownError = e;
 }

  expect(rollbackCalled).toBe(true);
  expect(commitCalled).toBe(false);
  expect(thrownError).toBeInstanceOf(RollbackError);
});
