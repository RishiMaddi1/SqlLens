import { Node } from "@xyflow/react";

export function filterNodes(searchParam: String, nodes: Node[], match: Boolean) {
    const query = searchParam.toLowerCase();

    return nodes.filter(node => {
        const data = node.data as any;
        const tableName = data.tableName?.toLowerCase() || '';
        const alias = data.alias?.toLowerCase() || '';
        const cteName = data.cteName?.toLowerCase() || '';

        return match
            ? tableName.startsWith(query) || alias.startsWith(query) || cteName.startsWith(query)
            : !(tableName.startsWith(query) || alias.startsWith(query) || cteName.startsWith(query))
    })
}