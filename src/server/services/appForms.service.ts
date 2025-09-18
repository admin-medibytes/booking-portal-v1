import { db } from "@/server/db";
import {
  appForms,
  appFormFields,
  type AppForm,
  type AppFormField,
  type NewAppForm,
  type NewAppFormField,
  type AppFormWithFields,
} from "@/server/db/schema/appForms";
import { acuityForms, acuityFormsFields } from "@/server/db/schema/acuity";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

export class AppFormsService {
  /**
   * List all app forms with their linked Acuity form details
   */
  async listAppForms() {
    try {
      const forms = await db
        .select({
          id: appForms.id,
          name: appForms.name,
          description: appForms.description,
          isActive: appForms.isActive,
          createdAt: appForms.createdAt,
          updatedAt: appForms.updatedAt,
          acuityForm: {
            id: acuityForms.id,
            name: acuityForms.name,
            description: acuityForms.description,
          },
        })
        .from(appForms)
        .innerJoin(acuityForms, eq(appForms.acuityFormId, acuityForms.id))
        .orderBy(desc(appForms.createdAt));

      return forms;
    } catch (error) {
      logger.error("Failed to list app forms", error as Error);
      throw error;
    }
  }

  /**
   * Get a single app form by ID with all its fields
   */
  async getAppFormById(id: string): Promise<AppFormWithFields> {
    try {
      // Get the app form
      const [form] = await db.select().from(appForms).where(eq(appForms.id, id)).limit(1);

      if (!form) {
        throw new NotFoundError("App form not found");
      }

      // Get all fields for this form with their Acuity field details
      const fields = await db
        .select({
          id: appFormFields.id,
          appFormId: appFormFields.appFormId,
          acuityFieldId: appFormFields.acuityFieldId,
          examineeFieldMapping: appFormFields.examineeFieldMapping,
          customLabel: appFormFields.customLabel,
          placeholderText: appFormFields.placeholderText,
          helpText: appFormFields.helpText,
          tooltipText: appFormFields.tooltipText,
          customFieldType: appFormFields.customFieldType,
          isRequired: appFormFields.isRequired,
          validationRules: appFormFields.validationRules,
          isHidden: appFormFields.isHidden,
          staticValue: appFormFields.staticValue,
          displayOrder: appFormFields.displayOrder,
          displayWidth: appFormFields.displayWidth,
          createdAt: appFormFields.createdAt,
          updatedAt: appFormFields.updatedAt,
          // Include Acuity field details
          acuityField: {
            id: acuityFormsFields.id,
            name: acuityFormsFields.name,
            type: acuityFormsFields.type,
            required: acuityFormsFields.required,
            options: acuityFormsFields.options,
          },
        })
        .from(appFormFields)
        .innerJoin(acuityFormsFields, eq(appFormFields.acuityFieldId, acuityFormsFields.id))
        .where(eq(appFormFields.appFormId, id))
        .orderBy(asc(appFormFields.displayOrder));

      return {
        ...form,
        fields: fields.map((f) => ({
          id: f.id,
          appFormId: f.appFormId,
          acuityFieldId: f.acuityFieldId,
          acuityFieldName: f.acuityField.name,
          customLabel: f.customLabel,
          placeholderText: f.placeholderText,
          helpText: f.helpText,
          tooltipText: f.tooltipText,
          customFieldType: f.customFieldType,
          isRequired: f.isRequired,
          validationRules: f.validationRules,
          isHidden: f.isHidden,
          staticValue: f.staticValue,
          displayOrder: f.displayOrder,
          displayWidth: f.displayWidth,
          examineeFieldMapping: f.examineeFieldMapping,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
      };
    } catch (error) {
      logger.error("Failed to get app form by ID", error as Error, { id });
      throw error;
    }
  }

  /**
   * Create a new app form from an Acuity form
   */
  async createAppForm(acuityFormId: number, data: { name: string; description?: string }) {
    try {
      // Check if Acuity form exists
      const [acuityForm] = await db
        .select()
        .from(acuityForms)
        .where(eq(acuityForms.id, acuityFormId))
        .limit(1);

      if (!acuityForm) {
        throw new NotFoundError("Acuity form not found");
      }

      // Check if app form already exists for this Acuity form
      const [existingAppForm] = await db
        .select()
        .from(appForms)
        .where(eq(appForms.acuityFormId, acuityFormId))
        .limit(1);

      if (existingAppForm) {
        throw new ValidationError("App form already exists for this Acuity form");
      }

      // Get all Acuity form fields
      const acuityFields = await db
        .select()
        .from(acuityFormsFields)
        .where(eq(acuityFormsFields.formId, acuityFormId))
        .orderBy(asc(acuityFormsFields.id));

      // Use transaction to create form and fields
      const result = await db.transaction(async (tx) => {
        // Create the app form
        const [newForm] = await tx
          .insert(appForms)
          .values({
            acuityFormId,
            name: data.name,
            description: data.description,
            isActive: true,
          })
          .returning();

        // Create default field configurations for each Acuity field
        if (acuityFields.length > 0) {
          const fieldValues: NewAppFormField[] = acuityFields.map((field, index) => ({
            appFormId: newForm.id,
            acuityFieldId: field.id,
            customLabel: null,
            placeholderText: null,
            helpText: null,
            tooltipText: null,
            customFieldType: null,
            isRequired: field.required,
            validationRules: {},
            isHidden: false,
            staticValue: null,
            displayOrder: index + 1,
            displayWidth: "full" as const,
          }));

          await tx.insert(appFormFields).values(fieldValues);
        }

        return newForm;
      });

      logger.info("Created app form", {
        appFormId: result.id,
        acuityFormId,
        name: data.name,
      });

      return result;
    } catch (error) {
      logger.error("Failed to create app form", error as Error, { acuityFormId });
      throw error;
    }
  }

  /**
   * Update an app form's metadata
   */
  async updateAppForm(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ) {
    try {
      const [updated] = await db
        .update(appForms)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(appForms.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundError("App form not found");
      }

      logger.info("Updated app form", { appFormId: id, updates: data });

      return updated;
    } catch (error) {
      logger.error("Failed to update app form", error as Error, { id });
      throw error;
    }
  }

  /**
   * Update app form fields configuration
   */
  async updateAppFormFields(appFormId: string, fields: Partial<AppFormField>[]) {
    try {
      // Verify app form exists
      const [form] = await db.select().from(appForms).where(eq(appForms.id, appFormId)).limit(1);

      if (!form) {
        throw new NotFoundError("App form not found");
      }

      // Update each field
      const updates = await db.transaction(async (tx) => {
        const updatedFields = [];

        for (const field of fields) {
          if (!field.id) continue;

          // Validate custom field type is only set for textbox fields
          if (field.customFieldType) {
            const [acuityField] = await tx
              .select({ type: acuityFormsFields.type })
              .from(appFormFields)
              .innerJoin(acuityFormsFields, eq(appFormFields.acuityFieldId, acuityFormsFields.id))
              .where(eq(appFormFields.id, field.id))
              .limit(1);

            if (acuityField?.type !== "textbox") {
              throw new ValidationError(
                `Custom field type can only be set for textbox fields. Field ${field.id} is type: ${acuityField?.type}`
              );
            }
          }

          const [updated] = await tx
            .update(appFormFields)
            .set({
              customLabel: field.customLabel,
              placeholderText: field.placeholderText,
              helpText: field.helpText,
              tooltipText: field.tooltipText,
              customFieldType: field.customFieldType,
              isRequired: field.isRequired,
              validationRules: field.validationRules,
              isHidden: field.isHidden,
              staticValue: field.staticValue,
              displayOrder: field.displayOrder,
              displayWidth: field.displayWidth,
              examineeFieldMapping: field.examineeFieldMapping,
              updatedAt: new Date(),
            })
            .where(and(eq(appFormFields.id, field.id), eq(appFormFields.appFormId, appFormId)))
            .returning();

          if (updated) {
            updatedFields.push(updated);
          }
        }

        // Update the app form's updatedAt timestamp
        await tx.update(appForms).set({ updatedAt: new Date() }).where(eq(appForms.id, appFormId));

        return updatedFields;
      });

      logger.info("Updated app form fields", {
        appFormId,
        fieldsUpdated: updates.length,
      });

      return updates;
    } catch (error) {
      logger.error("Failed to update app form fields", error as Error, { appFormId });
      throw error;
    }
  }

  /**
   * Delete an app form
   */
  async deleteAppForm(id: string) {
    try {
      const [deleted] = await db.delete(appForms).where(eq(appForms.id, id)).returning();

      if (!deleted) {
        throw new NotFoundError("App form not found");
      }

      logger.info("Deleted app form", { appFormId: id });

      return { success: true, deleted };
    } catch (error) {
      logger.error("Failed to delete app form", error as Error, { id });
      throw error;
    }
  }

  /**
   * Get app form by Acuity form ID
   */
  async getAppFormByAcuityFormId(acuityFormId: number) {
    try {
      const [form] = await db
        .select()
        .from(appForms)
        .where(eq(appForms.acuityFormId, acuityFormId))
        .limit(1);

      return form; // Returns undefined if not found, which is fine
    } catch (error) {
      // Only log if it's an actual database error, not just "not found"
      logger.error("Database error while checking app form", error as Error, { acuityFormId });
      throw error;
    }
  }

  /**
   * Get public form configuration for rendering
   */
  async getPublicAppForm(id: string) {
    try {
      const form = await this.getAppFormById(id);

      if (!form.isActive) {
        throw new NotFoundError("Form is not active");
      }

      // Filter out sensitive data for public view
      return {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: form.fields.map((field) => ({
          id: field.id,
          acuityFieldId: field.acuityFieldId,
          customLabel: field.customLabel,
          placeholderText: field.placeholderText,
          helpText: field.helpText,
          tooltipText: field.tooltipText,
          customFieldType: field.customFieldType,
          isRequired: field.isRequired,
          validationRules: field.validationRules,
          isHidden: field.isHidden,
          displayOrder: field.displayOrder,
          displayWidth: field.displayWidth,
        })),
      };
    } catch (error) {
      logger.error("Failed to get public app form", error as Error, { id });
      throw error;
    }
  }
}

export const appFormsService = new AppFormsService();
