/**
 * Ticket: model-level roles AND namespaces (`@roles(["agent"])` + `@namespace(["support"])`).
 */
import { bootBackend, type Backend } from "./harness/backend";
import { httpAdapter, rejection, repositoryFor, statusOf, uid } from "./harness/client";
import { Users } from "./harness/users";
import { Ticket, TicketPriority } from "../../src/index";

describe("Ticket API — @roles + @namespace", () => {
  let backend: Backend;
  let tickets: ReturnType<typeof repositoryFor<Ticket>>;

  const ticket = (id: string, extra: Partial<Ticket> = {}) =>
    new Ticket({ id, subject: "Grinder is noisy", priority: TicketPriority.MEDIUM, ...extra });

  beforeAll(async () => {
    backend = await bootBackend();
    tickets = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.supportAgent) }),
      Ticket
    );
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("full CRUD for an agent scoped to the support namespace", async () => {
    const id = uid("tkt");
    const created = await tickets.create(ticket(id, { description: "since last update" }));
    expect(created.createdBy).toBe(Users.supportAgent.email);

    const escalated = await tickets.update(
      new Ticket({ ...(await tickets.read(id)), priority: TicketPriority.HIGH })
    );
    expect(escalated.priority).toBe(TicketPriority.HIGH);

    const high = await tickets.findBy("priority", TicketPriority.HIGH);
    expect(high.map((t) => t.id)).toContain(id);

    await tickets.delete(id);
    expect(statusOf(await rejection(() => tickets.read(id)))).toBe(404);
  });

  it("rejects an agent that is not in the support namespace", async () => {
    const repo = repositoryFor(
      httpAdapter(backend.host, {
        token: await backend.keycloak.token(Users.agentWithoutNamespace),
      }),
      Ticket
    );
    const error = await rejection(() => repo.create(ticket(uid("tkt"))));
    expect(statusOf(error)).toBe(403);
  });

  it("rejects a support-namespace user without the agent role", async () => {
    const repo = repositoryFor(
      httpAdapter(backend.host, { token: await backend.keycloak.token(Users.supportWithoutRole) }),
      Ticket
    );
    const error = await rejection(() => repo.listBy("id", "asc" as any));
    expect(statusOf(error)).toBe(403);
  });

  it("explains which claim is missing", async () => {
    const call = async (persona: keyof typeof Users) => {
      const res = await fetch(`${backend.baseUrl}/ticket/any`, {
        headers: { Authorization: `Bearer ${await backend.keycloak.token(Users[persona])}` },
      });
      return ((await res.json()) as any).error as string;
    };
    expect(await call("agentWithoutNamespace")).toContain("Missing required namespaces: support");
    expect(await call("supportWithoutRole")).toContain("Missing required roles: agent");
  });
});
