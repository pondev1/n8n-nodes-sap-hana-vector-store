import { INodePropertyOptions } from 'n8n-workflow';

export const metadataFilterField = {
	displayName: 'Metadata Filter',
	name: 'metadata',
	type: 'fixedCollection' as const,
	description: 'Metadata to filter the document by',
	typeOptions: {
		multipleValues: true,
	},
	default: {},
	placeholder: 'Add filter field',
	options: [
		{
			name: 'metadataValues',
			displayName: 'Fields to Set',
			values: [
				{
					displayName: 'Name',
					name: 'name',
					type: 'string' as const,
					default: '',
					required: true,
				},
				{
					displayName: 'Value',
					name: 'value',
					type: 'string' as const,
					default: '',
				},
			],
		},
	],
};

export function getTemplateNoticeField(templateId: string) {
	return {
		displayName: `Save time with an <a href="/templates/${templateId}" target="_blank">example</a> of how this node works`,
		name: 'notice',
		type: 'notice' as const,
		default: '',
	};
}

export function getBatchingOptionFields(displayOptions: any, defaultBatchSize: number = 5) {
	return {
		displayName: 'Batch Processing',
		name: 'batching',
		type: 'collection' as const,
		placeholder: 'Add Batch Processing Option',
		description: 'Batch processing options for rate limiting',
		default: {},
		options: [
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				default: defaultBatchSize,
				type: 'number' as const,
				description: 'How many items to process in parallel. This is useful for rate limiting, but might impact the log output ordering.',
			},
			{
				displayName: 'Delay Between Batches',
				name: 'delayBetweenBatches',
				default: 0,
				type: 'number' as const,
				description: 'Delay in milliseconds between batches. This is useful for rate limiting.',
			},
		],
		displayOptions,
	};
}

// Define connection types as constants (as used in n8n)
const AI_AGENT = 'ai_agent';
const AI_CHAIN = 'ai_chain';
const AI_DOCUMENT = 'ai_document';
const AI_VECTOR_STORE = 'ai_vectorStore';
const AI_RETRIEVER = 'ai_retriever';

const connectionsString = {
	[AI_AGENT]: {
		connection: '',
		locale: 'AI Agent',
	},
	[AI_CHAIN]: {
		connection: '',
		locale: 'AI Chain',
	},
	[AI_DOCUMENT]: {
		connection: AI_DOCUMENT,
		locale: 'Document Loader',
	},
	[AI_VECTOR_STORE]: {
		connection: AI_VECTOR_STORE,
		locale: 'Vector Store',
	},
	[AI_RETRIEVER]: {
		connection: AI_RETRIEVER,
		locale: 'Vector Store Retriever',
	},
};

function determineArticle(nextWord: string): string {
	const vowels = /^[aeiouAEIOU]/;
	return vowels.test(nextWord) ? 'an' : 'a';
}

const getConnectionParameterString = (connectionType: string): string => {
	if (connectionType === '') return "data-action-parameter-creatorview='AI'";
	return `data-action-parameter-connectiontype='${connectionType}'`;
};

const getAhref = (connectionType: { connection: string; locale: string }): string =>
	`<a class="test" data-action='openSelectiveNodeCreator'${getConnectionParameterString(
		connectionType.connection,
	)}'>${connectionType.locale}</a>`;

export function getConnectionHintNoticeField(connectionTypes: string[]) {
	const groupedConnections = new Map<string, string[]>();
	connectionTypes.forEach((connectionType) => {
		const connectionString = (connectionsString as any)[connectionType]?.connection || '';
		const localeString = (connectionsString as any)[connectionType]?.locale || connectionType;
		if (!groupedConnections.has(connectionString)) {
			groupedConnections.set(connectionString, [localeString]);
			return;
		}
		groupedConnections.get(connectionString)?.push(localeString);
	});

	let displayName: string;
	if (groupedConnections.size === 1) {
		const [[connection, locales]] = Array.from(groupedConnections);
		displayName = `This node must be connected to ${determineArticle(locales[0])} ${locales[0]
			.toLowerCase()
			.replace(/^ai /, 'AI ')}. <a data-action='openSelectiveNodeCreator' ${getConnectionParameterString(
			connection,
		)}>Insert one</a>`;
	} else {
		const ahrefs = Array.from(groupedConnections, ([connection, locales]) => {
			const locale =
				locales.length > 1
					? locales
							.map((localeString, index, { length }) => {
								return (
									(index === 0 ? `${determineArticle(localeString)} ` : '') +
									(index < length - 1 ? `${localeString} or ` : localeString)
								);
							})
							.join('')
					: `${determineArticle(locales[0])} ${locales[0]}`;
			return getAhref({ connection, locale });
		});
		displayName = `This node needs to be connected to ${ahrefs.join(' or ')}.`;
	}

	return {
		displayName,
		name: 'notice',
		type: 'notice' as const,
		default: '',
		typeOptions: {
			containerClass: 'ndv-connection-hint-notice',
		},
	};
}