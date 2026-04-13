import { Electroview } from "electrobun/view";
import type { RoadmapRPCType } from "../../../../shared/types";

const rpc = Electroview.defineRPC<RoadmapRPCType>({
	handlers: {
		requests: {},
		messages: {},
	},
});

export const electroview = new Electroview({ rpc });
