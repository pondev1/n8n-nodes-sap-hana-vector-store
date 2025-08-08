import { INodePropertyOptions } from 'n8n-workflow';
import { DEFAULT_OPERATION_MODES, OPERATION_MODE_DESCRIPTIONS, OperationModeDescription } from './constants';

interface VectorStoreNodeArgs {
	meta: {
		operationModes?: string[];
		[key: string]: any;
	};
	[key: string]: any;
}

interface FieldWithDisplayOptions {
	displayOptions?: {
		show?: {
			mode?: string | string[];
		};
	};
	[key: string]: any;
}

export function transformDescriptionForOperationMode(
	fields: any[],
	mode: string | string[],
): FieldWithDisplayOptions[] {
	return fields.map((field) => ({
		...field,
		displayOptions: { 
			show: { 
				mode: Array.isArray(mode) ? mode : [mode] 
			} 
		},
	}));
}

export function isUpdateSupported(args: VectorStoreNodeArgs): boolean {
	return args.meta.operationModes?.includes("update") ?? false;
}

export function getOperationModeOptions(args: VectorStoreNodeArgs): INodePropertyOptions[] {
	const enabledOperationModes = args.meta.operationModes ?? DEFAULT_OPERATION_MODES;
	return OPERATION_MODE_DESCRIPTIONS.filter(
		({ value }: OperationModeDescription) => enabledOperationModes.includes(value),
	).map(({ name, value, description, action }: OperationModeDescription) => ({
		name,
		value,
		description,
		action,
	}));
}