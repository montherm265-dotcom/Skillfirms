import { describe, expect, it, beforeEach } from "vitest";
import { clearJobGoal, jobGoalFromParams, jobGoalUrl, readJobGoal, rememberJobGoal } from "./jobGoal";

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = globalThis.window ?? { dispatchEvent() {} };
globalThis.Event = globalThis.Event ?? class { constructor(t) { this.type = t; } };

const id = "7d4f4362-98f4-4b52-8031-3867e899be37";
const p = (q) => new URLSearchParams(q);

describe("job goal", () => {
  beforeEach(() => clearJobGoal());

  it("reads a Skill Bridge link", () => {
    const g = jobGoalFromParams(p(`from=talfirms&jobId=${id}&job=HVAC%20Engineer&skills=GMP|URS&now=64&target=82`));
    expect(g).toEqual({ id, title: "HVAC Engineer", now: 64, target: 82, skills: ["GMP", "URS"] });
  });

  it("ignores links not from Talfirms or with a bad id", () => {
    expect(jobGoalFromParams(p(`jobId=${id}&job=X`))).toBeNull();
    expect(jobGoalFromParams(p("from=talfirms&jobId=../../evil&job=X"))).toBeNull();
    expect(jobGoalFromParams(p(`from=talfirms&jobId=${id}`))).toBeNull();
  });

  it("remembers it and keeps known skills for the same job", () => {
    rememberJobGoal({ id, title: "HVAC Engineer", skills: ["GMP"] });
    rememberJobGoal({ id, title: "HVAC Engineer", skills: [] });
    expect(readJobGoal().skills).toEqual(["GMP"]);
    expect(jobGoalUrl(readJobGoal())).toMatch(new RegExp(`/opportunities/${id}$`));
    clearJobGoal();
    expect(readJobGoal()).toBeNull();
  });
});
