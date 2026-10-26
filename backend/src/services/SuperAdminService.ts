class SuperAdminService {

  // platform admin verify - env credentials nai login ho
  static async createDefaultPlatformAdmin() {
    const email = process.env.PLATFORM_ADMIN_EMAIL;
    const password = process.env.PLATFORM_ADMIN_PASSWORD;

    if (!email || !password) {
      console.log(
        "PLATFORM_ADMIN_EMAIL/PASSWORD not set - platform admin login disabled",
      );
      return;
    }

    console.log(
      "Platform Admin ready (env credentials)",
    );
  }
}


export default SuperAdminService;