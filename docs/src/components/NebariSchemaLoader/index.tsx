import React, { useState, useEffect } from 'react';
import { Resolver } from '@stoplight/json-ref-resolver';
import Heading from '@theme/Heading';
import ReactMarkdown from 'react-markdown';
import CodeBlock from '@theme/CodeBlock';
import Admonition from '@theme/Admonition';
import Details from '@theme/Details';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

// Define the correct schema type
type SchemaProperty = {
    deprecated?: boolean;
    description?: string;
};

type Properties = {
    [key: string]: SchemaProperty;
};

type Schema = {
    title: string;
    description: string;
    type: string;
    properties: Properties;
};

const defaultSchema: Schema = {
    "title": "Nebari Configuration",
    "description": "The configuration schema for Nebari.",
    "type": "object",
    "properties": {
        "deprecated": {
            deprecated: true
        }
    }
};

function useSchema(schemaUrl: string) {
    const [schema, setSchema] = useState<Schema>(defaultSchema);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSchema() {
            try {
                const response = await fetch(schemaUrl, { headers: { Accept: 'application/json' } });
                const rawSchema = await response.json();
                const resolver = new Resolver();
                const resolvedSchema = await resolver.resolve(rawSchema, {});
                setSchema(resolvedSchema.result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchSchema();
    }, [schemaUrl]);

    return { schema, loading, error };
}

export default function NebariConfig({ toc = null }) {
    const schemaUrl = "https://raw.githubusercontent.com/viniciusdc/nebari/nebari-schema-models/nebari-config-schema.json";
    const { schema, loading, error } = useSchema(schemaUrl);

    if (loading) return <p>Loading schema...</p>;
    if (error) return <p>Error loading schema: {error}</p>;
    if (!schema) return null;

    return (
        <>
            <Admonition type="info">
                This documentation is autogenerated from the Nebari configuration JSON Schema.
                <a href={schemaUrl} target="_blank">View the original schema</a>.
            </Admonition>
            <SchemaToc properties={schema.properties} />
            <Markdown text={schema.description} />
            <PropertiesList properties={schema.properties} />
        </>
    );
}

function SchemaToc({ properties }: { properties: Properties }) {
    const propertyEntries = Object.entries(properties).sort();
    return (
        <ul>
            {propertyEntries.map(([key, value]) => (
                <li key={key}>
                    <a href={`#${key.replace(/_/g, "-")}`}>
                        {value.deprecated ? <span style={{ textDecoration: "line-through" }}>{key}</span> : key}
                    </a>
                </li>
            ))}
        </ul>
    );
}

function PropertiesList({ properties }: { properties: Properties }) {
    return (
        <>
            {Object.entries(properties).map(([key, value]) => (
                <PropertyDetail key={key} name={key} property={value} />
            ))}
        </>
    );
}

function PropertyDetail({ name, property, level = 1 }: { name: string; property: SchemaProperty; level?: number }) {
    return (
        <>
            <a id={name.replace("_", "-")}></a>
            <Heading as={`h${level + 2}`} id={name.replace(/_/g, "-")}>
                {property.deprecated ? <span style={{ textDecoration: "line-through" }}>{name}</span> : name}
            </Heading>
            {property.deprecated && <p><span className="badge badge--danger">Deprecated</span></p>}
            {property.description && <Markdown text={property.description} />}
        </>
    );
}

const Markdown = ({ text }: { text: string }) => <ReactMarkdown>{text}</ReactMarkdown>;
