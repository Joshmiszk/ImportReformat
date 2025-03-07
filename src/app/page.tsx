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
    TempNote?: string;
    FirmName?: string;
    Unit?: string;
    FirstName: string;
    LastName: string;
    Email: string;
    Phone: string;
    Street?: string;
    City?: string;
    ProvinceState?: string;
    PostalCodeZip?: string;
    DateOfBirth?: string;
    "BorrowerStage.Name"?: BorrowerStage;
    "PartnerType.Name"?: string;
    LeadSource?: string;
    Campaign?: string;
}

class ContactDataProcessor {
    // Helper function to get column value dynamically by column name
    private getColumnValue(row: any, columnName: string): string {
        const foundColumn = Object.keys(row).find(key => key.toLowerCase().includes(columnName.toLowerCase()));
        return foundColumn ? row[foundColumn] : "";
    }

    private formatRow(row: any): FormattedRow {
        // Extract First and Last Name (using dynamic header search)
        let FirstName = "";
        let LastName = "";
        const fullName = this.getColumnValue(row, "First name") + " " + this.getColumnValue(row, "Last name");
        if (fullName.trim()) {
            const nameParts = fullName.trim().split(" ");
            FirstName = nameParts[0];
            LastName = nameParts.slice(1).join(" ");
        }

        // Standardize Date of Birth (looking for the appropriate column by name)
        let DateOfBirth = "";
        const rawDOB = this.getColumnValue(row, "Date Registered"); // Assuming date is in the "Date Registered" column
        if (rawDOB) {
            const parsedDate = new Date(rawDOB);
            if (!isNaN(parsedDate.getTime())) {
                DateOfBirth = parsedDate.toISOString().split("T")[0];
            } else {
                DateOfBirth = rawDOB;
            }
        }

        // Address Processing (dynamic header recognition for address-related fields)
        let Street = this.getColumnValue(row, "Street") || ""; // Changed "Address" to "Street"
        let City = this.getColumnValue(row, "City") || "";
        let ProvinceState = this.getColumnValue(row, "ProvinceState") || "";
        let PostalCodeZip = this.getColumnValue(row, "PostalCodeZip") || "";

        // Other fields
        const Email = this.getColumnValue(row, "Email");
        const Phone = this.getColumnValue(row, "Phone number");
        const FirmName = this.getColumnValue(row, "Company name"); // Assuming Firm name is in the "Company name" column
        const PartnerType = this.getColumnValue(row, "Profession"); // Assuming this is the "Partner Type"
        
        // Generate TempNote if any note-related fields exist
        const TempNote = this.getColumnValue(row, "Tag"); // Assuming tag is used for notes here

        // Prepare the final result object
        let result: FormattedRow = {
            FirstName,
            LastName,
            Email,
            Phone,
            Street,  // Now correctly labeled as "Street"
            City,
            ProvinceState,
            PostalCodeZip,
            DateOfBirth,
            "BorrowerStage.Name": FILE_CONSTANTS.DEFAULT_STAGE, // Default if not specified
            "PartnerType.Name": PartnerType,
            LeadSource: "", // Add logic if needed for lead source
            Campaign: "",   // Add logic if needed for campaign
            TempNote,
            FirmName,
        };

        // Iterate over the row and add any unmapped columns at the end of the result
        Object.keys(row).forEach((key) => {
            if (!result.hasOwnProperty(key)) {
                result[key] = row[key]; // Add extra columns not already included
            }
        });

        return result;
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
