"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { PaymentWizard, type PayCustomer } from "@/components/admin/PaymentWizard";
import { Button } from "@/components/ui";

/** Großer Knopf „Zahlung erfassen“, der den geführten Ablauf aufklappt */
export function PaymentPanel({ customers, initialCustomerId, open }: { customers: PayCustomer[]; initialCustomerId?: string; open: boolean }) {
  const t = useTranslations("admin.finance.pay");
  const [show, setShow] = useState(open);
  if (!show) {
    return (
      <Button onClick={() => setShow(true)} data-testid="pay-open">
        <Icon name="plus" className="size-4" /> {t("title")}
      </Button>
    );
  }
  return <PaymentWizard customers={customers} initialCustomerId={initialCustomerId} />;
}
