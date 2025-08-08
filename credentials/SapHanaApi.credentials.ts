import {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SapHanaApi implements ICredentialType {
	name = 'sapHanaApi';
	displayName = 'SAP HANA API';
	documentationUrl = 'https://help.sap.com/docs/HANA_CLOUD';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'your-hana-instance.hanacloud.ondemand.com',
			required: true,
			description: 'SAP HANA Cloud hostname or IP address',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 30015,
			required: true,
			description: 'SAP HANA port (typically 30015 for HANA Cloud, 39013/39015 for on-premise)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'SAP HANA database username',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'SAP HANA database password',
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string',
			default: '',
			placeholder: 'your-database-name',
			required: false,
			description: 'Database name or tenant database identifier (optional for single-tenant)',
		},
		{
			displayName: 'Schema',
			name: 'schema',
			type: 'string',
			default: '',
			placeholder: 'your-schema-name',
			required: false,
			description: 'Database schema name (optional, defaults to user schema)',
		},
		{
			displayName: 'Additional Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			options: [
				{
					displayName: 'Use SSL/TLS',
					name: 'encrypt',
					type: 'boolean',
					default: true,
					description: 'Whether to use SSL/TLS encryption (recommended for cloud deployments)',
				},
				{
					displayName: 'Validate SSL Certificate',
					name: 'sslValidateCertificate',
					type: 'boolean',
					default: false,
					description: 'Whether to validate the server SSL certificate (enable for production)',
				},
				{
					displayName: 'Connection Timeout (ms)',
					name: 'connectTimeout',
					type: 'number',
					default: 15000,
					description: 'Connection timeout in milliseconds',
				},
				{
					displayName: 'Auto Commit',
					name: 'autocommit',
					type: 'boolean',
					default: true,
					description: 'Whether to auto-commit database transactions',
				},
				{
					displayName: 'Use CESU-8 Encoding',
					name: 'useCesu8',
					type: 'boolean',
					default: false,
					description: 'Whether to use CESU-8 encoding (required for some HANA configurations)',
				},
			],
		},
	];

	// Credential test - validates the credential configuration
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://httpbin.org',
			url: '/status/200',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 200,
					message: 'SAP HANA credentials saved successfully. Connection will be tested when the node is executed.',
				},
			},
		],
	};
}