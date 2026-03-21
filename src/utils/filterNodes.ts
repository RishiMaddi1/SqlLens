import type { Node } from '@xyflow/react';

export function filterNodes(
    searchParam: string,
    nodes: Node[],
    match: boolean
): Node[] {
    const query = searchParam.toLowerCase();

    return nodes.filter((node) => {
        const data = node.data as {
            tableName?: string;
            alias?: string;
            cteName?: string;
        };
        const tableName = data.tableName?.toLowerCase() ?? '';
        const alias = data.alias?.toLowerCase() ?? '';
        const cteName = data.cteName?.toLowerCase() ?? '';

        const isMatch =
            tableName.startsWith(query) ||
            alias.startsWith(query) ||
            cteName.startsWith(query);

        return match ? isMatch : !isMatch;
    });
}
