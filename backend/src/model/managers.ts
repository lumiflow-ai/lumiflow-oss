import type { OrgManager } from "@/model/org";
import type { UserManager } from "@/model/user";

export type Managers = {
  org: OrgManager;
  user: UserManager;
};
