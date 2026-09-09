import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp,
} from "firebase/firestore";

const projectId = "demo-member4-roles";
const rules = readFileSync(
  fileURLToPath(new URL("../../../firestore.rules", import.meta.url)), "utf8"
);
let env;

const profile = (uid, role = "USER", submitterStatus = "none") => ({
  uid,
  email: `${uid}@example.test`,
  name: uid,
  photoURL: "",
  role,
  submitterStatus,
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

function context(uid) {
  return env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}
function userRef(db, uid) {
  return doc(db, "users", uid);
}
function requestFields() {
  return {
    submitterStatus: "pending",
    requestedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
  };
}
function reviewFields(decision, reason = "") {
  return {
    role: decision === "approved" ? "SUBMITTER" : "USER",
    submitterStatus: decision,
    reviewedAt: serverTimestamp(),
    reviewedBy: "admin",
    reviewReason: reason,
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(userRef(db, "admin"), profile("admin", "ADMIN")),
      setDoc(userRef(db, "alice"), profile("alice")),
      setDoc(userRef(db, "bob"), profile("bob")),
    ]);
  });
});

after(async () => {
  await env?.cleanup();
});

describe("Firestore role and deletion security", () => {
  it("allows normal profile creation but rejects self-promotion", async () => {
    const db = context("newuser");
    await assertSucceeds(setDoc(userRef(db, "newuser"), profile("newuser")));
    await assertFails(setDoc(userRef(db, "another"), profile("another")));
    await assertFails(updateDoc(userRef(db, "newuser"), { role: "ADMIN" }));
    await assertFails(updateDoc(userRef(db, "newuser"), {
      role: "SUBMITTER", submitterStatus: "approved",
    }));
  });

  it("allows an owner to request access but not approve themselves", async () => {
    const db = context("alice");
    await assertSucceeds(updateDoc(userRef(db, "alice"), requestFields()));
    await assertFails(updateDoc(userRef(db, "alice"), { submitterStatus: "approved" }));
    await assertFails(updateDoc(userRef(db, "alice"), { role: "ADMIN" }));
    await assertFails(updateDoc(userRef(db, "alice"), { deletionPending: false }));
  });

  it("requires a pending request and records the reviewing administrator", async () => {
    const alice = context("alice");
    const admin = context("admin");
    await assertSucceeds(updateDoc(userRef(alice, "alice"), requestFields()));
    await assertSucceeds(updateDoc(userRef(admin, "alice"), reviewFields("approved")));
    await assertFails(updateDoc(userRef(admin, "alice"), { role: "ADMIN" }));
    await assertFails(updateDoc(userRef(admin, "alice"), reviewFields("rejected", "No")));
    await assertFails(updateDoc(userRef(alice, "alice"), { submitterStatus: "pending" }));
  });

  it("requires a rejection reason and permits resubmission", async () => {
    const alice = context("alice");
    const admin = context("admin");
    await assertSucceeds(updateDoc(userRef(alice, "alice"), requestFields()));
    await assertFails(updateDoc(userRef(admin, "alice"), reviewFields("rejected")));
    await assertSucceeds(updateDoc(userRef(admin, "alice"), reviewFields("rejected", "Insufficient details")));
    await assertSucceeds(updateDoc(userRef(alice, "alice"), requestFields()));
  });

  it("prevents non-admin reviews, self-review and arbitrary admin promotion", async () => {
    const alice = context("alice");
    const bob = context("bob");
    const admin = context("admin");
    await assertSucceeds(updateDoc(userRef(alice, "alice"), requestFields()));
    await assertFails(updateDoc(userRef(bob, "alice"), reviewFields("approved")));
    await assertFails(updateDoc(userRef(admin, "admin"), { role: "USER" }));
    await assertFails(updateDoc(userRef(admin, "bob"), { role: "ADMIN" }));
    await assertFails(updateDoc(userRef(admin, "alice"), {
      ...reviewFields("approved"), reviewedBy: "bob",
    }));
  });

  it("enforces private profiles and administrator-only collection queries", async () => {
    const alice = context("alice");
    const admin = context("admin");
    await assertSucceeds(getDoc(userRef(alice, "alice")));
    await assertFails(getDoc(userRef(alice, "bob")));
    await assertFails(getDocs(collection(alice, "users")));
    await assertSucceeds(getDocs(query(
      collection(admin, "users"), where("submitterStatus", "==", "pending")
    )));
  });

  it("blocks client deletion and deleted-account resurrection", async () => {
    const alice = context("alice");
    await assertFails(deleteDoc(userRef(alice, "alice")));
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, "accountDeletions", "alice"), { deleted: true });
      await deleteDoc(userRef(db, "alice"));
    });
    await assertFails(setDoc(userRef(alice, "alice"), profile("alice")));
    await assertFails(getDoc(userRef(alice, "alice")));
    await assertFails(getDoc(doc(alice, "accountDeletions", "alice")));
  });

  it("does not permit a pending-deletion profile to request or receive approval", async () => {
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(userRef(context.firestore(), "bob"), {
        deletionPending: true, submitterStatus: "pending",
      });
    });
    await assertFails(updateDoc(userRef(context("bob"), "bob"), requestFields()));
    await assertFails(updateDoc(userRef(context("admin"), "bob"), reviewFields("approved")));
  });

  it("rejects a second review after the first decision", async () => {
    const alice = context("alice");
    const admin = context("admin");
    await assertSucceeds(updateDoc(userRef(alice, "alice"), requestFields()));
    await assertSucceeds(updateDoc(userRef(admin, "alice"), reviewFields("approved")));
    await assertFails(updateDoc(userRef(admin, "alice"), reviewFields("rejected", "Too late")));
  });
});
