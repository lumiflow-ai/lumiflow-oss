import { RouteGroup } from "@/lib/routeGroup";

import { signup } from "./signup";

export const signupRoutes = new RouteGroup("signup");
signupRoutes.install(signup);
