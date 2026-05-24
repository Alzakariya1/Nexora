import React, { useState } from "react";
import { authApi } from "../api";

function Login({ onLogin }) {
  const [form, setForm] = useState({
    email: "admin@hospital.com",
    password: "admin12345",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await authApi.login(form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="loginWrap">
      <form className="card login" onSubmit={submit}>
        <h1>Enterprise HMS</h1>
        <p>Login to manage hospital operations.</p>
        {error && <div className="error">{error}</div>}
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <small>
          After DB import, run backend seed to use admin@hospital.com /
          admin12345.
        </small>
      </form>
    </div>
  );
}

export default Login;
