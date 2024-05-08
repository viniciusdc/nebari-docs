import { Resolver } from '@stoplight/json-ref-resolver';
import Admonition from '@theme/Admonition';
import Details from '@theme/Details';
import Heading from '@theme/Heading';
import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

// import JSONSchema from '../../../static/nebari-config-schema.json';

const schemaUrl = "https://raw.githubusercontent.com/viniciusdc/nebari/nebari-schema-models/nebari-config-schema.json";

type SchemaProperty = {
    deprecated?: boolean;
    description?: string;
    type?: string | string[];
    pattern?: string;
    title?: string;
    items?: any;
    properties?: { [key: string]: SchemaProperty };
    enum?: string[];
    default?: any;
    allOf?: SchemaProperty[];
    examples?: string[];
    optionsAre?: string[];
    note?: string;
};

type Properties = { [key: string]: SchemaProperty };

type Schema = {
    title: string;
    description: string;
    type: string;
    properties: Properties;
    required?: string[];
};

const defaultSchema: Schema = {
    title: "ConfigSchema",
    description: "The configuration schema for Nebari.",
    type: "object",
    properties: {}
};

function useSchema(schemaUrl: string, useLocal = false) {
    const [schema, setSchema] = useState<Schema>(defaultSchema);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (useLocal) {
            const resolver = new Resolver();
            resolver.resolve(JSONSchema, {}).then((resolvedSchema) => {
                setSchema(resolvedSchema.result);
            });
            setLoading(false);
            setError(null);
        } else {
            async function fetchSchema() {
                try {
                    const response = await fetch(schemaUrl, { headers: { 'Accept': 'application/json' } });
                    if (!response.ok) {
                        throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
                    }

                    const json = await response.json();
                    const resolver = new Resolver();
                    const resolvedSchema = await resolver.resolve(json, {});
                    setSchema(resolvedSchema.result);
                } catch (err) {
                    console.error('Error:', err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            }

            fetchSchema();
        }
    }, [schemaUrl, useLocal]);  // Added useLocal as a dependency

    return { schema, loading, error };
}

export default function NebariConfig() {
    const { schema, loading, error } = useSchema(schemaUrl, false);

    if (loading) return <p>Loading schema...</p>;
    if (error) return <p>Error loading schema: {error}</p>;

    return (
        <>
            <Admonition type="info">
                This documentation is autogenerated from the Nebari configuration JSON Schema.
                <a href={schemaUrl} target="_blank" rel="noopener noreferrer">View the original schema</a>.
            </Admonition>
            {/* <Details>
                <pre>{JSON.stringify(schema, null, 2)}</pre>
            </Details> */}
            <SchemaToc schema={schema} />
            <Markdown text={schema.description} />
            <PropertiesList properties={schema.properties} />
        </>
    );
}

function SchemaToc({ schema }) {
    return (
        <ul>
            {Object.entries(schema.properties).sort().map(([key, value]) => (
                <li key={key}>
                    <a href={`#${key.replace(/_/g, "-")}`}>
                        {value.deprecated ? <span style={{ textDecoration: "line-through" }}>{key}</span> : key}
                    </a>
                </li>
            ))}
        </ul>
    );
}

function PropertieTitle({ title, subHeading = false, deprecated = false }) {
    const titleStyle = {
        background: 'linear-gradient(to right, var(--ifm-color-primary) 0%, var(--ifm-color-primary) 5px, var(--ifm-admonition-background-color) 5px, var(--ifm-admonition-background-color) 100%)',
        padding: '8px 15px',
        borderRadius: '5px',
        display: 'inline-block'
    };
    return (
        <div>
            <Heading as={subHeading ? 'h3' : 'h2'} id={title.replace(/_/g, '-')}>
                <span style={titleStyle}>
                    {title} {deprecated && <span className="badge badge--danger">Deprecated</span>}
                </span>
            </Heading>
        </div>
    );
}

function PropertiesList({ properties, sub_heading = false }: { properties: Properties; sub_heading?: boolean }) {
    return (
        <>
            {Object.entries(properties).map(([key, value]) => (
                <div key={key}>
                    {/* // if sub_heading is true, render a heading for each property as an
                    // h3, else render the property title as an h2 */}
                    <PropertieTitle title={key} subHeading={sub_heading} deprecated={value.deprecated} />
                    <PropertyContent property={value} />
                    {/* Check if value.allOf is defined and has entries */}
                    {value.allOf && value.allOf.length > 0 ? (
                        value.allOf[0].properties ? (
                            <Details summary={<summary>Available Options</summary>}>
                                {/* If the first item in allOf has properties, display them as a nested list */}
                                <PropertiesList properties={mergeAllOf(value).properties ?? {}} sub_heading />
                            </Details>
                        ) : null
                    ) : (
                        null
                    )}
                </div>
            ))}
        </>
    );
}

function mergeAllOf(property: SchemaProperty): SchemaProperty {
    if (!property.allOf) return property;
    // Start with a clone of the original property without the allOf key
    const base = { ...property, allOf: undefined };
    // Merge all properties from the allOf array into the base
    return property.allOf.reduce((acc, cur) => ({
        ...acc,
        ...mergeAllOf(cur), // Recursively merge all nested allOf properties
        properties: { ...acc.properties, ...cur.properties } // Merge nested properties separately
    }), base);
}

const MarkdownCodeSeparator = ({ examples, inputKey }) => {
    // Function to extract the YAML code block and briefing paragraph from each example
    const parseContent = (input) => {
        const codeRegex = /```yaml[\s\S]*?```/;  // Regex to match the YAML code block
        const codeMatch = input.match(codeRegex);

        let codeBlock = '';
        if (codeMatch) {
            // Extract code and remove the fencing
            codeBlock = codeMatch[0].replace(/```yaml|```/g, '').trim();
            // Normalize indentation
            const lines = codeBlock.split('\n');
            const minIndentation = lines.filter(line => line.trim())
                .reduce((min, line) => Math.min(min, line.search(/\S/)), Infinity);
            codeBlock = lines.map(line => line.substring(minIndentation)).join('\n');
        }

        const briefing = input.replace(codeRegex, '').trim();  // Remove the code block from the briefing

        return { briefing, codeBlock };
    };

    // Check if examples is defined and is an array
    if (!Array.isArray(examples)) {
        return <div>No examples provided</div>;
    }

    if (examples.length > 1) {
        // Render content inside tabs when there are multiple examples
        return (
            <Tabs defaultValue="example-0" values={examples.map((_, index) => ({ label: `Example ${index + 1}`, value: `example-${index}` }))}>
                {examples.map((example, index) => {
                    const { briefing, codeBlock } = parseContent(example); // Correct placement
                    return (
                        <TabItem key={index} value={`example-${index}`}>
                            <div>
                                <ReactMarkdown>{briefing}</ReactMarkdown>
                                <pre style={{ borderRadius: '8px', border: '1px solid #ccc', padding: '10px', overflow: 'auto' }}>
                                    {codeBlock}
                                </pre>
                            </div>
                        </TabItem>
                    );
                })}
            </Tabs>
        );
    } else {
        // If only one example, no need for tabs
        const { briefing, codeBlock } = parseContent(examples[0]);
        return (
            <div key={inputKey}>
                <ReactMarkdown>{briefing}</ReactMarkdown>
                <pre style={{ borderRadius: '8px', border: '1px solid #ccc', padding: '10px', overflow: 'auto' }}>
                    {codeBlock}
                </pre>
            </div>
        );
    }
};

function PropertyContent({ property }) {
    // Helper function to check if any table data is available
    const hasTableData = property.type || property.default !== undefined || property.enum || property.optionsAre || property.pattern || property.deprecated;

    return (
        <div className="property-content">
            {property.description && (
                <div className="property-description">
                    <ReactMarkdown>{property.description}</ReactMarkdown>
                </div>
            )}
            {hasTableData && (
                <table className="property-details" style={{ borderCollapse: 'collapse', borderRadius: '8px', border: '1px solid #ccc' }}>
                    {/* Adding CSS within the component */}
                    <style>
                        {`
                            .property-details tbody tr:nth-child(even) {
                                background-color: var(--ifm-admonition-background-color);
                            }
                        `}
                    </style>
                    <tbody>
                        {property.type && (
                            <tr>
                                <th style={{ fontWeight: 'bold', padding: '8px' }}>Type:</th>
                                <td style={{ padding: '8px', }} width="100%">
                                    <code>{Array.isArray(property.type) ? property.type.join(", ") : property.type}</code>
                                </td>
                            </tr>
                        )}
                        {property.default !== undefined && (
                            <tr>
                                <th style={{ fontWeight: 'bold', padding: '8px', }}>Default:</th>
                                <td style={{ padding: '8px', }} width="100%">
                                    <code>{JSON.stringify(property.default)}</code>
                                </td>
                            </tr>
                        )}
                        {property.enum && (
                            <tr>
                                <th style={{ fontWeight: 'bold', padding: '8px', }}>Available options:</th>
                                <td style={{ padding: '8px', }} width="100%">{property.enum.join(", ")}</td>
                            </tr>
                        )}
                        {property.optionsAre && (
                            <tr>
                                <th style={{ fontWeight: 'bold', padding: '8px', }}>Options:</th>
                                <td style={{ padding: '8px', }} width="100%">{property.optionsAre.join(", ")}</td>
                            </tr>
                        )}
                        {property.pattern && (
                            <tr>
                                <th style={{ fontWeight: 'bold', padding: '8px', }}>Pattern:</th>
                                <td style={{ padding: '8px', }} width="100%">
                                    <code>{property.pattern}</code>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
            {property.examples && (
                <div className="property-examples">
                    <MarkdownCodeSeparator examples={property.examples} inputKey="examples" />
                </div>
            )}
            {property.note && (
                <Admonition type="note">
                    <Markdown text={property.note} />
                </Admonition>
            )}
        </div>
    );
}


const Markdown = ({ text }: { text: string }) => <ReactMarkdown>{text}</ReactMarkdown>;
