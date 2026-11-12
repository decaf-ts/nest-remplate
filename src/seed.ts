/**
 * @module nest-template/seed
 * @description Demo data loaded on boot.
 */
import { Repository } from "@decaf-ts/core";
import { NotFoundError } from "@decaf-ts/db-decorators";
import { Category } from "./models/Category";

/**
 * @description Categories available out of the box.
 * @const SEED_CATEGORIES
 */
export const SEED_CATEGORIES: ReadonlyArray<{ id: string; name: string; description: string }> = [
  { id: "coffee", name: "Coffee", description: "Beans, ground and capsules" },
  { id: "equipment", name: "Equipment", description: "Grinders, kettles and brewers" },
  { id: "accessories", name: "Accessories", description: "Cups, filters and scales" },
];

/**
 * @description Seeds the demo categories (idempotent).
 * @summary `Category` blocks CREATE/UPDATE/DELETE on its generated API (`@BlockOperations`); the
 * repository is not affected, which is how server-owned reference data is maintained.
 * @return {Promise<void>}
 * @function seed
 */
export async function seed(): Promise<void> {
  const repo = Repository.forModel(Category);
  for (const data of SEED_CATEGORIES) {
    try {
      await repo.read(data.id);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
      await repo.create(new Category(data));
    }
  }
}
