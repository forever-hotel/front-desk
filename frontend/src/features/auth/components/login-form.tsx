"use client";
import { Alert, Button, Form, Input } from "antd";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ change = false }: { change?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(values: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/auth/" + (change ? "change-password" : "login"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            change
              ? {
                  currentPassword: values.currentPassword,
                  newPassword: values.newPassword,
                }
              : values,
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Unable to sign in");
      router.replace(data.passwordChangeRequired ? "/change-password" : "/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-page, #f5f3ef)",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 32,
          background: "var(--card-surface)",
          border: "1px solid var(--border, #ddd8cf)",
          borderRadius: 12,
        }}
      >
        <p style={{ color: "var(--gold)", letterSpacing: 2 }}>FOREVER HOTEL</p>
        <h1 style={{ color: "var(--navy)", fontSize: 24, margin: "16px 0" }}>
          {change ? "Change your initial password" : "Front Desk sign in"}
        </h1>
        {error && (
          <Alert
            type="error"
            title={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          {!change && (
            <Form.Item
              label="Username or email"
              name="username"
              rules={[{ required: true }]}
            >
              <Input autoComplete="username" />
            </Form.Item>
          )}
          <Form.Item
            label={change ? "Current password" : "Password"}
            name={change ? "currentPassword" : "password"}
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {change && (
            <>
              <Form.Item
                label="New password"
                name="newPassword"
                rules={[{ required: true, min: 12, max: 72 }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                label="Confirm new password"
                name="confirm"
                dependencies={["newPassword"]}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator: (_, value) =>
                      value === getFieldValue("newPassword")
                        ? Promise.resolve()
                        : Promise.reject(new Error("Passwords must match")),
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </>
          )}
          <Button type="primary" htmlType="submit" block loading={busy}>
            {change ? "Change password" : "Sign in"}
          </Button>
        </Form>
      </section>
    </main>
  );
}
