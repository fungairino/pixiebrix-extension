import React, { useCallback } from "react";
import { useToasts } from "react-toast-notifications";
import { v4 as uuidv4 } from "uuid";
import { connect } from "react-redux";
import { optionsSlice } from "@/options/slices";
import { push } from "connected-react-router";
import { useParams } from "react-router";
import { useExtension } from "@/selectors";
import ExtensionPointDetail, { Config } from "./ExtensionPointDetail";
import WorkshopPage from "@/options/pages/extensionEditor/WorkshopPage";
import { reactivate } from "@/background/navigation";

const { saveExtension } = optionsSlice.actions;

interface OwnProps {
  navigate: (target: string) => void;
  saveExtension: (
    config: Config & { extensionPointId: string; extensionId: string }
  ) => void;
}

interface RouteParams {
  extensionPointId: string | null;
  extensionId: string;
}

const ExtensionEditor: React.FunctionComponent<OwnProps> = ({
  saveExtension,
  navigate,
}) => {
  const { addToast } = useToasts();
  const { extensionPointId, extensionId } = useParams<RouteParams>();
  const { extensionPoint, extensionConfig } = useExtension(
    extensionPointId ? decodeURIComponent(extensionPointId) : undefined,
    extensionId
  );

  const save = useCallback(
    ({ config, label, services }, { setSubmitting }) => {
      if (!extensionPoint) {
        return;
      }
      try {
        const isNew = !extensionConfig?.id;
        const extensionId = extensionConfig?.id ?? uuidv4();
        saveExtension({
          extensionPointId: extensionPoint.id,
          extensionId,
          config,
          services,
          label,
        });

        const toastMsg = extensionConfig?.id
          ? "Updated brick"
          : "Activated brick";

        addToast(toastMsg, {
          appearance: "success",
          autoDismiss: true,
        });

        if (isNew) {
          navigate(`/workshop/extensions/${extensionId}`);
        }

        reactivate();
      } finally {
        setSubmitting(false);
      }
    },
    [extensionPoint, extensionConfig, saveExtension, addToast]
  );

  if (!extensionPoint) {
    return <WorkshopPage navigate={navigate} />;
  } else {
    return (
      <ExtensionPointDetail
        saveCaption={extensionConfig ? "Update Brick" : "Activate Brick"}
        initialValue={{
          label: extensionConfig?.label,
          config: extensionConfig?.config,
          services: extensionConfig?.services ?? [],
        }}
        extensionId={extensionId}
        extensionPoint={extensionPoint}
        onSave={save}
      />
    );
  }
};

export default connect(undefined, { saveExtension, navigate: push })(
  ExtensionEditor
);
