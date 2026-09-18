import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.rag_engine import rag_engine

SAMPLE_REGULATIONS = [
    {
        "country_code": "DEU",
        "category": "VISA",
        "topic": "German National Student Visa (Section 16b AufenthG)",
        "source_reference": "German Federal Foreign Office - Student Visa Directive",
        "required_docs": ["PASSPORT", "DEGREE", "ADMISSION_LETTER", "BLOCKED_ACCOUNT_PROOF", "HEALTH_INSURANCE"],
        "text": """
        Applicants applying for a German Student Visa must submit a recognized, valid passport 
        with at least two blank pages, issued within the past 10 years and valid for at least 
        3 months past the intended stay. Required paperwork includes the unconditional university 
        admission letter, recognized secondary or bachelor degree certificates, proof of financial 
        resources (such as an active blocked account meeting federal minimum deposit thresholds), 
        and statutory incoming travel health insurance coverage.
        """
    },
    {
        "country_code": "IND",
        "category": "IDENTITY",
        "topic": "Indian Passport Renewal Procedure",
        "source_reference": "Passport Seva Kendra - Document Advisory",
        "required_docs": ["PASSPORT", "NATIONAL_ID", "PROOF_OF_ADDRESS"],
        "text": """
        For passport re-issue or renewal under normal or tatkaal schemes, the applicant 
        must present their original expired or expiring booklet (with self-attested copies 
        of the first two and last two pages), valid proof of present residential address 
        (e.g., utility bill or bank statement), and a valid secondary national identity 
        verification document.
        """
    }
]

def seed():
    print("Indexing bureaucratic guidelines into ChromaDB...")
    total = 0
    for item in SAMPLE_REGULATIONS:
        count = rag_engine.index_regulatory_document(
            raw_text=item["text"],
            country_code=item["country_code"],
            category=item["category"],
            topic=item["topic"],
            source_reference=item["source_reference"],
            required_docs=item["required_docs"],
        )
        total += count
    print(f"Indexing complete. Inserted {total} guideline chunks.")

if __name__ == "__main__":
    seed()