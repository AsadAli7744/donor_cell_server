import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { User } from "../users/user.entity";
import { GeographicScopeService } from "../permissions/geographic-scope/geographic-scope.service";
import { TenancyService } from "../tenancy/tenancy.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly geographicScopeService: GeographicScopeService,
    private readonly tenancy: TenancyService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    return await this.usersService.validateUser(email, password);
  }

  async login(user: User) {
    if (!user.tenant_id || !this.tenancy.isActive(user.tenant_id)) {
      throw new ForbiddenException("This organization is suspended");
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      tenant_id: user.tenant_id,
    };

    // We don't need to return the token as it will be set in cookie by the controller
    const token = await this.jwtService.signAsync(payload);

    // Extract permissions from the user relation
    const permissions = user?.permissions?.permissions || {};

    const geographic = this.usersService.pickGeographicContext(user);
    const scope = await this.geographicScopeService.resolveForUser(
      user.id,
      user.role,
      user,
    );

    return {
      token, // This will be set as cookie by controller
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        department: user.department,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        dob: user.dob,
        address: user.address,
        cnic: user.cnic,
        gender: user.gender,
        joining_date: user.joining_date,
        emergency_contact: user.emergency_contact,
        blood_group: user.blood_group,
        is_archived: user?.is_archived,
        ...geographic,
        geographic_scope: this.geographicScopeService.toScopeSummary(scope),
        tenant_id: user.tenant_id,
      },
      permissions,
      entitlements: this.tenancy.enabledModuleMap(user.tenant_id),
      tenant: this.tenancy.getCached(user.tenant_id),
    };
  }

  entitlementsFor(tenantId: number) {
    return this.tenancy.enabledModuleMap(tenantId);
  }

  tenantProfile(tenantId: number) {
    return this.tenancy.getCached(tenantId) || null;
  }

  getGeographicContextForUser(user: User) {
    return this.usersService.pickGeographicContext(user);
  }

  async getGeographicScopeSummaryForUser(user: User) {
    const scope = await this.geographicScopeService.resolveForUser(
      user.id,
      user.role,
      user,
    );
    return this.geographicScopeService.toScopeSummary(scope);
  }

  async validateToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.usersService.findByEmail(payload.email);
      if (!user || !user.isActive || user?.is_archived) {
        throw new UnauthorizedException(
          "User not found or inactive or archived",
        );
      }
      return user;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
