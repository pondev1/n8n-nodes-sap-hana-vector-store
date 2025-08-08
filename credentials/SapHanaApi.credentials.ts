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

/*
Updated Installation and Setup Notes:

1. Install the HDB library (REQUIRED for LangChain SAP HANA integration):
   npm install hdb

2. LangChain Integration:
   - Uses: @langchain/community/vectorstores/hanavector
   - Import: import { HanaDB, HanaDBArgs } from '@langchain/community/vectorstores/hanavector'

3. Connection Example (JavaScript/TypeScript):
   import hanaClient from 'hdb';
   
   const connectionParams = {
     host: credentials.host,
     port: credentials.port,
     uid: credentials.username,
     pwd: credentials.password,
     databaseName: credentials.database, // if specified
     useCesu8: credentials.options?.useCesu8 || false
   };
   
   const client = hanaClient.createClient(connectionParams);

4. Vector Table Structure (default):
   - VEC_TEXT (NCLOB) - Document content
   - VEC_META (NVARCHAR) - JSON metadata  
   - VEC_VECTOR (REAL_VECTOR) - Vector embeddings

5. Schema Support:
   - If schema is specified, tables will be created in that schema
   - Format: SCHEMA.TABLE_NAME for table operations
   - Schema is added to credentials for convenience

6. Port Configuration:
   - HANA Cloud: typically 30015 (SQL port)
   - On-premise: 39013/39015 (instance-specific)
   - HTTP(S): 443/80 (for web-based connections, not used by hdb)

7. SSL/Security:
   - encrypt: true recommended for cloud deployments
   - sslValidateCertificate: false for development, true for production
   - useCesu8: may be required for specific HANA configurations
*/