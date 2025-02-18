'use client';

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import OpenAI from "openai";

// Types and Constants
type BorrowerStage = "Active Lead" | "Business Partner Only" | "Prospect" | "Client";

const FILE_CONSTANTS = {
    VALID_STAGES: ["Active Lead", "Business Partner Only", "Prospect", "Client"] as BorrowerStage[],
    DEFAULT_STAGE: "Prospect" as BorrowerStage,
    OUTPUT_FILENAME: "formatted_contacts.csv",
    SHEET_NAME: "Formatted Data",
} as const;

interface RawRow {
    "Full Name"?: string;
    "Date"?: string;
    "BorrowerStage.Name"?: string;
    "PartnerType.Name"?: string;
    "LeadSource"?: string;
    "Campaign"?: string;
    "Email"?: string;
    "Phone"?: string;
    "Address"?: string;
    "City"?: string;
    "Province"?: string;
    "Postal Code"?: string;
}

interface FormattedRow {
    FirstName: string;
    LastName: string;
    Email: string;
    Phone: string;
    Address: string;
    City: string;
    Province: string;
    PostalCode: string;
    DateOfBirth: string;
    "BorrowerStage.Name": BorrowerStage;
    "PartnerType.Name": string;
    LeadSource: string;
    Campaign: string;
}

class ContactDataProcessor {
    private readonly openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, dangerouslyAllowBrowser: true});
    }

    private formatRow(row: RawRow): FormattedRow {
        const [FirstName, LastName] = row["Full Name"]?.split(" ") || ["", ""];
        const DateOfBirth = row["Date"]
            ? new Date(row["Date"]).toISOString().split("T")[0]
            : "";

        const stageName = row["BorrowerStage.Name"] as BorrowerStage;
        const BorrowerStageName = FILE_CONSTANTS.VALID_STAGES.includes(stageName)
            ? stageName
            : FILE_CONSTANTS.DEFAULT_STAGE;

        return {
            FirstName,
            LastName,
            Email: row["Email"] || "",
            Phone: row["Phone"] || "",
            Address: row["Address"] || "",
            City: row["City"] || "",
            Province: row["Province"] || "",
            PostalCode: row["Postal Code"] || "",
            DateOfBirth,
            "BorrowerStage.Name": BorrowerStageName,
            "PartnerType.Name": row["PartnerType.Name"] || "",
            LeadSource: row["LeadSource"] || "",
            Campaign: row["Campaign"] || "",
        };
    }

    private async enhanceWithAI(data: FormattedRow[]): Promise<FormattedRow[]> {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are a helpful assistant that formats and corrects contact data for a CRM." },
                    { role: "user", content: `Format and clean the following contact data: ${JSON.stringify(data)}` }
                ]
            });

            const content = response.choices[0].message.content;
            if (!content) {
                console.warn("OpenAI returned empty content");
                return data;
            }

            return JSON.parse(content) as FormattedRow[];
        } catch (error) {
            console.error("OpenAI API Error:", error);
            return data;
        }
    }


    async processFile(file: File): Promise<FormattedRow[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e: ProgressEvent<FileReader>) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: "array" });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json<RawRow>(sheet);
                    const formattedData = rawData.map(row => this.formatRow(row));
                    const enhancedData = await this.enhanceWithAI(formattedData);
                    resolve(enhancedData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => {
                reject(new Error("Error reading file"));
            };

            reader.readAsArrayBuffer(file);

        });
    }

    exportToCSV(data: FormattedRow[]): void {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, FILE_CONSTANTS.SHEET_NAME);
        XLSX.writeFile(workbook, FILE_CONSTANTS.OUTPUT_FILENAME);
    }
}

export default function Home() {
    const [file, setFile] = useState<File | null>(null);
    const [processedData, setProcessedData] = useState<FormattedRow[] | null>(null);
    const processor = new ContactDataProcessor();

    const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const uploadedFile = event.target.files[0];
        if (uploadedFile) {
            setFile(uploadedFile);
        }
    };

    const handleProcessFile = async () => {
        if (!file) return;
        try {
            const data = await processor.processFile(file);
            setProcessedData(data);
        } catch (error) {
            console.error("Error processing file:", error);
        }
    };


    const handleDownloadCSV = () => {
        if (!processedData) return;
        processor.exportToCSV(processedData);
    };

    return (
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <Input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} />
                        <div className="flex justify-between">
                        <Button onClick={handleProcessFile} disabled={!file}>Process File</Button>
                        {processedData && <Button onClick={handleDownloadCSV}>Download CSV</Button>}
                        </div>
                    </CardContent>
                </Card>
            </main>
            <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
                <div>Test</div>
            </footer>
        </div>
    );
}