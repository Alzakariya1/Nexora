import React from "react";
import { Form } from "../components";

function initials(name = "User") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("") || "U";
}

function roleLabel(role = "user") {
  return String(role).replace(/_/g, " ");
}

export default function AdminProfile({
  user,
  profile,
  setProfile,
  updateProfile,
  handleProfileImageUpload,
  passwordForm,
  setPasswordForm,
  changePassword,
  newUser,
  setNewUser,
  addUser,
  userSearch,
  setUserSearch,
  roleFilter,
  setRoleFilter,
  filteredUsers,
  toggleUserStatus,
  deleteUser,
  permissions = {},
}) {
  const canManageUsers = Boolean(permissions.adminUsersManage);
  const completionScore = [profile.full_name, profile.email, profile.bio, profile.profile_image].filter(Boolean).length;
  const completionPercent = Math.round((completionScore / 4) * 100);

  return (
    <section className="keka-profile-page admin-profile-modern">
      <div className="keka-cover-card">
        <div className="keka-cover-art"></div>
        <div className="keka-cover-content">
          <div className="keka-avatar-wrap">
            {profile.profile_image ? (
              <img src={profile.profile_image} alt={profile.full_name || "Profile"} />
            ) : (
              <span>{initials(profile.full_name || user?.full_name || "User")}</span>
            )}
          </div>
          <div className="keka-person-title">
            <h1>{profile.full_name || user?.full_name || "My Profile"}</h1>
            <p>{roleLabel(profile.role || user?.role || "user")} • {profile.email || user?.email || "No email added"}</p>
          </div>
          <div className="keka-profile-score">
            <div className="score-ring">{completionPercent}%</div>
            <div>
              <b>{completionPercent === 100 ? "Profile complete" : "Your profile is incomplete"}</b>
              <span>Keep your user profile updated</span>
            </div>
          </div>
        </div>
      </div>

      <div className="keka-profile-layout">
        <div className="keka-main-column">
          <div className="keka-section-card introduce-card">
            <div className="keka-card-title-row">
              <div>
                <h2>Introduce yourself</h2>
                <p>We would love to know more about you and your work profile.</p>
              </div>
              <span className="keka-mini-score">{completionScore}/4</span>
            </div>
            <div className="keka-bio-box">
              <span>About</span>
              <p>{profile.bio || "Add a short professional bio so your hospital team can understand your role, responsibilities, and expertise."}</p>
            </div>
            <div className="keka-bio-grid">
              <div className="keka-bio-box">
                <span>Role</span>
                <p>{roleLabel(profile.role || user?.role || "user")}</p>
              </div>
              <div className="keka-bio-box">
                <span>Email</span>
                <p>{profile.email || user?.email || "Not added"}</p>
              </div>
            </div>
          </div>

          <form className="keka-section-card form" onSubmit={updateProfile}>
            <div className="keka-card-title-row">
              <div>
                <h2>Edit Profile</h2>
                <p>Update name, photo and bio for the logged-in user.</p>
              </div>
            </div>
            <div className="formGrid">
              <input
                placeholder="Name"
                value={profile.full_name || ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
              <input placeholder="Email / Gmail" value={profile.email || ""} disabled />
              <label className="keka-file-tile">
                <i className="bi bi-camera"></i>
                <span>Upload profile photo</span>
                <input type="file" accept="image/*" onChange={handleProfileImageUpload} hidden />
              </label>
              <textarea
                placeholder="Bio"
                value={profile.bio || ""}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              />
            </div>
            <button>Update Profile</button>
          </form>

          <div className="keka-section-card quick-links-card">
            <h2>Quick links</h2>
            <p>Useful profile and hospital administration shortcuts.</p>
            <div className="keka-quick-grid">
              <button type="button" className="keka-link-btn"><span>Security Settings</span><i className="bi bi-box-arrow-up-right"></i></button>
              <button type="button" className="keka-link-btn"><span>Audit Logs</span><i className="bi bi-box-arrow-up-right"></i></button>
              <button type="button" className="keka-link-btn"><span>Hospital Settings</span><i className="bi bi-box-arrow-up-right"></i></button>
              <button type="button" className="keka-link-btn"><span>Compliance Center</span><i className="bi bi-box-arrow-up-right"></i></button>
            </div>
          </div>

          <form className="keka-section-card form" onSubmit={changePassword}>
            <h2>Change Password</h2>
            <p>Keep your account secure with a strong password.</p>
            <div className="formGrid">
              <input
                type="password"
                placeholder="Old Password"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
              />
              <input
                type="password"
                placeholder="New Password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>
            <button>Change Password</button>
          </form>

          {canManageUsers && (
            <>
              <div className="keka-section-card">
                <h2>Add New User / Role</h2>
                <p>Create controlled access for hospital team members.</p>
                <Form title="" data={newUser} setData={setNewUser} submit={addUser} />
              </div>

              <div className="keka-section-card">
                <div className="keka-card-title-row">
                  <div>
                    <h2>User List</h2>
                    <p>Manage active users and access status.</p>
                  </div>
                </div>
                <div className="keka-filter-row">
                  <input placeholder="Search user..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="all">All Roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Platform Admin</option>
                    <option value="hospital_admin">Hospital Admin</option>
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="lab_technician">Lab Technician</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </div>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td>{u.full_name}</td>
                          <td>{u.email}</td>
                          <td>{roleLabel(u.role)}</td>
                          <td>{permissions.adminUsersManage ? <button onClick={() => toggleUserStatus(u)}>{u.status}</button> : u.status}</td>
                          <td>
                            {u.email !== user?.email ? (
                              permissions.adminUsersManage ? <button onClick={() => deleteUser(u)}>Delete</button> : <span className="muted">No access</span>
                            ) : <button disabled>Current User</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="keka-side-column">
          <div className="keka-help-card">
            <div className="hr-badge">HR</div>
            <div>
              <h3>We're here to assist you</h3>
              <p>Human Resource<br /><span>Process Lead</span></p>
              <small><i className="bi bi-envelope"></i> hr@hospital.com</small>
            </div>
          </div>
          <div className="keka-help-card light">
            <h3>Explore HMS</h3>
            <p>Access profile, documents, security, users and compliance from one place.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
