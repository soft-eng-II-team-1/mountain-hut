-- Preserve each existing description and allergy flag as the first list entry.
ALTER TABLE "reservation"
    ALTER COLUMN "requirements" TYPE JSONB USING (
        CASE
            WHEN "requirements" IS NULL OR BTRIM("requirements") = '' THEN '[]'::JSONB
            ELSE JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
                'has_allergies', "has_allergies",
                'description', BTRIM("requirements")
            ))
        END
    ),
    ALTER COLUMN "requirements" SET DEFAULT '[]'::JSONB,
    ALTER COLUMN "requirements" SET NOT NULL;
