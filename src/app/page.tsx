'use client';

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

// Types and Constants
type BorrowerStage = "Active Lead" | "Business Partner Only" | "Prospect" | "Client";

const FILE_CONSTANTS = {
    VALID_STAGES: ["Active Lead", "Business Partner Only", "Prospect", "Client"] as BorrowerStage[],
    DEFAULT_STAGE: "Prospect" as BorrowerStage,
    OUTPUT_FILENAME: "formatted_contacts.csv",
    SHEET_NAME: "Formatted Data",
} as const;

interface FormattedRow {
    FirstName: string;
    LastName: string;
    Email: string;
    Phone: string;
    Address?: string;
    City?: string;
    Province?: string;
    PostalCode?: string;
    DateOfBirth?: string;
    "BorrowerStage.Name"?: BorrowerStage;
    "PartnerType.Name"?: string;
    LeadSource?: string;
    Campaign?: string;
}

class ContactDataProcessor {
    private formatRow(row: any): FormattedRow {
        // Extract First and Last Name
        let FirstName = "";
        let LastName = "";
        if (row[Object.keys(row)[0]]) {
            const nameParts = row[Object.keys(row)[0]].trim().split(" ");
            FirstName = nameParts.length > 1 ? nameParts[0] : row[Object.keys(row)[0]];
            LastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        }

        // Standardize Date of Birth
        let DateOfBirth = "";
        if (row[Object.keys(row)[1]]) {
            const rawDOB = row[Object.keys(row)[1]].toString();
            const parsedDate = new Date(rawDOB);
            if (!isNaN(parsedDate.getTime())) {
                DateOfBirth = parsedDate.toISOString().split("T")[0];
            } else {
                DateOfBirth = rawDOB;
            }
        }

        // Address processing with flexible parsing
        let Address = "", City = "", Province = "", PostalCode = "";
        if (row["Address"]) {
            let addressParts = row["Address"].split(/[,\n]/).map(part => part.trim());
            if (addressParts.length < 3) {
                const spaceParts = row["Address"].split(/\s+/);
                PostalCode = spaceParts.pop() || "";
                Province = spaceParts.pop() || "";
                City = spaceParts.pop() || "";
                Address = spaceParts.join(" ");
            } else {
                Address = addressParts[0] || "";
                City = addressParts[1] || "";
                Province = addressParts[2] || "";
                PostalCode = addressParts.length > 3 ? addressParts[3] : "";
            }
        }

        return {
            FirstName,
            LastName,
            Email: row[Object.keys(row)[3]] || "",
            Phone: row[Object.keys(row)[2]] || "",
            Address,
            City,
            Province,
            PostalCode,
            DateOfBirth,
            "BorrowerStage.Name": FILE_CONSTANTS.VALID_STAGES.includes(row["BorrowerStage.Name"]) ? row["BorrowerStage.Name"] as BorrowerStage : FILE_CONSTANTS.DEFAULT_STAGE,
            "PartnerType.Name": row["PartnerType.Name"] || "",
            LeadSource: row["LeadSource"] || "",
            Campaign: row["Campaign"] || "",
        };
    }

    async processFile(file: File): Promise<FormattedRow[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: "array" });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json(sheet);

                    const formattedData = rawData.map(row => this.formatRow(row));
                    resolve(formattedData);
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
        setFile(event.target.files[0]);
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
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
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
        </div>
    );
}
